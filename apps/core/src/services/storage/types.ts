import type { Readable } from "node:stream";

export type PutObjectInput = {
	key: string; // object key, e.g. org/1/proj/2/files/abc
	body: Buffer | Readable; // upload source
	contentType?: string;
	contentDisposition?: string; // e.g. inline; filename="file.pdf"
	metadata?: Record<string, string>;
	cacheControl?: string;
	contentLength?: number; // recommended for streams
};

export type HeadObjectOutput = {
	key: string;
	exists: boolean;
	size?: number;
	contentType?: string;
	etag?: string;
	lastModified?: Date;
	metadata?: Record<string, string>;
};

export type SignedUrlOptions = {
	expiresInSeconds?: number; // default 600
	responseContentDisposition?: string; // for downloads
	responseContentType?: string;
};

export type S3Config = {
	bucket: string;
	region: string;

	accessKeyId: string;
	secretAccessKey: string;

	// AWS: omit endpoint. MinIO: set endpoint, and forcePathStyle=true
	endpoint?: string; // e.g. http://minio:9000
	forcePathStyle?: boolean; // true for MinIO in many setups

	// Optional: if internal endpoint differs from public (browser) endpoint
	publicEndpoint?: string; // e.g. https://s3.company.tld
};

export interface ObjectStorage {
	putObject(input: PutObjectInput): Promise<{ key: string; etag?: string }>;
	getObjectStream(
		key: string,
	): Promise<{ stream: Readable; contentType?: string; contentLength?: number }>;
	headObject(key: string): Promise<HeadObjectOutput>;
	deleteObject(key: string): Promise<void>;

	createSignedReadUrl(key: string, opts?: SignedUrlOptions): Promise<string>;
	// Optional but very useful for direct browser uploads:
	createSignedUploadUrl?(
		key: string,
		opts?: { expiresInSeconds?: number; contentType?: string },
	): Promise<string>;
}
