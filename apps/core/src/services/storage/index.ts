import type { Readable } from "node:stream";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
	HeadObjectOutput,
	ObjectStorage,
	PutObjectInput,
	S3Config,
	SignedUrlOptions,
} from "./types";
import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "@/env";

export class S3ObjectStorage implements ObjectStorage {
	private readonly bucket: string;
	private readonly s3: S3Client;
	private readonly publicEndpoint?: string;

	constructor(cfg: S3Config) {
		this.bucket = cfg.bucket;
		this.publicEndpoint = cfg.publicEndpoint;

		this.s3 = new S3Client({
			region: cfg.region,
			endpoint: cfg.endpoint,
			forcePathStyle: cfg.forcePathStyle ?? false,
			credentials: {
				accessKeyId: cfg.accessKeyId,
				secretAccessKey: cfg.secretAccessKey,
			},
		});
	}

	async putObject(input: PutObjectInput): Promise<{ key: string; etag?: string }> {
		const cmd = new PutObjectCommand({
			Bucket: this.bucket,
			Key: input.key,
			Body: input.body,
			ContentType: input.contentType,
			CacheControl: input.cacheControl,
			ContentDisposition: input.contentDisposition,
			Metadata: input.metadata,
		});
		const res = await this.s3.send(cmd);
		return { key: input.key, etag: res.ETag ?? undefined };
	}

	async getObjectStream(
		key: string,
	): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> {
		console.log("getObjectStream", key);
		const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
		const body = res.Body;
		if (!body || typeof (body as unknown as { pipe: () => void }).pipe !== "function")
			throw new Error("S3ObjectStorage: Body is not a stream");
		return {
			stream: body as unknown as Readable,
			contentType: res.ContentType ?? undefined,
			contentLength: res.ContentLength ?? undefined,
		};
	}

	async headObject(key: string): Promise<HeadObjectOutput> {
		try {
			const res = await this.s3.send(
				new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
			);
			return {
				key,
				exists: true,
				size: res.ContentLength ?? undefined,
				contentType: res.ContentType ?? undefined,
				etag: res.ETag ?? undefined,
				lastModified: res.LastModified ?? undefined,
				metadata: res.Metadata ?? undefined,
			};
		} catch (e: unknown) {
			// AWS SDK v3: NotFound / 404 vary by provider, handle by name/status
			const name = e instanceof Error ? e.name : "";
			const status =
				e instanceof Error
					? (e as unknown as { $metadata?: { httpStatusCode?: number } }).$metadata
							?.httpStatusCode
					: undefined;
			if (name === "NotFound" || status === 404) return { key, exists: false };
			throw e;
		}
	}

	async deleteObject(key: string): Promise<void> {
		await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
	}

	async createSignedReadUrl(key: string, opts?: SignedUrlOptions): Promise<string> {
		const expiresIn = opts?.expiresInSeconds ?? 600;

		const cmd = new GetObjectCommand({
			Bucket: this.bucket,
			Key: key,
			ResponseContentDisposition: opts?.responseContentDisposition,
			ResponseContentType: opts?.responseContentType,
		});

		let url = await getSignedUrl(this.s3, cmd, { expiresIn });

		// If you want the browser URL to use a public endpoint (e.g. https://s3.company.tld)
		// rewrite host while keeping signature query params intact.
		if (this.publicEndpoint) {
			url = rewriteSignedUrlHost(url, this.publicEndpoint);
		}

		return url;
	}

	async createSignedUploadUrl(
		key: string,
		opts?: { expiresInSeconds?: number; contentType?: string },
	): Promise<string> {
		const expiresIn = opts?.expiresInSeconds ?? 600;

		const cmd = new PutObjectCommand({
			Bucket: this.bucket,
			Key: key,
			ContentType: opts?.contentType,
		});

		let url = await getSignedUrl(this.s3, cmd, { expiresIn });

		if (this.publicEndpoint) {
			url = rewriteSignedUrlHost(url, this.publicEndpoint);
		}

		return url;
	}
}

function rewriteSignedUrlHost(signedUrl: string, publicEndpoint: string) {
	const u = new URL(signedUrl);
	const p = new URL(publicEndpoint);
	u.protocol = p.protocol;
	u.host = p.host;
	// keep pathname + query unchanged (signature lives in query)
	return u.toString();
}

/**
 * Centralized access to object storage service
 *
 * Uses singleton pattern to ensure a single point of access
 * to storage in the application.
 *
 * Advantages:
 * - no need to pass instance everywhere
 * - single point of access to storage
 * - easy to mock for tests
 * - lazy initialization from environment variables
 * - all parts of the app use the same storage instance
 */
function getStorageConfig(): S3Config {
	return {
		bucket: env.S3_BUCKET,
		region: env.S3_REGION,
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
		endpoint: env.S3_ENDPOINT,
		forcePathStyle: env.S3_FORCE_PATH_STYLE,
		publicEndpoint: env.S3_PUBLIC_ENDPOINT,
	};
}

// Singleton instance
let storageInstance: S3ObjectStorage | undefined;

/**
 * Get Storage instance (singleton)
 *
 * In development mode, use global variable to support hot-reload
 */
function getStorage(): S3ObjectStorage {
	if (process.env.NODE_ENV === "production") {
		if (!storageInstance) {
			storageInstance = new S3ObjectStorage(getStorageConfig());
		}
		return storageInstance;
	} else {
		// in development mode, use global variable to support hot-reload
		if (!global.__storage) {
			global.__storage = new S3ObjectStorage(getStorageConfig());
		}
		return global.__storage;
	}
}

declare global {
	// eslint-disable-next-line no-var
	var __storage: S3ObjectStorage | undefined;
}

// export singleton instance
export const storage = getStorage();
