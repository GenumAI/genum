import { storage } from "./storage";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { db } from "@/database/db";

export interface FileMetadata {
	id: string;
	key: string;
	name: string;
	size: number;
	contentType: string;
	projectId: number;
	createdAt: Date;
}

export type FileInput = {
	id: string;
	buffer: Buffer;
	url?: string;
	contentType: string;
	fileName: string;
};

export class FileService {
	/**
	 * Generate a unique ID
	 */
	private generateId(): string {
		return randomBytes(16).toString("hex");
	}

	/**
	 * Generate a unique key for file storage in S3
	 */
	private generateFileKey(orgId: number, projectId: number, fileName: string): string {
		const fileId = this.generateId();
		const ext = path.extname(fileName);
		const baseName = path.basename(fileName, ext);
		const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, "_");
		return `org/${orgId}/project/${projectId}/files/${fileId}-${sanitizedBaseName}${ext}`;
	}

	/**
	 * Validate file type (only images and PDFs allowed)
	 */
	private validateFileType(contentType: string, fileName: string): boolean {
		const allowedImageTypes = [
			"image/jpeg",
			"image/jpg",
			"image/png",
			"image/gif",
			"image/webp",
			"image/svg+xml",
		];
		const allowedPdfType = "application/pdf";

		const ext = path.extname(fileName).toLowerCase();
		const isImage =
			allowedImageTypes.includes(contentType) ||
			[".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext);
		const isPdf = contentType === allowedPdfType || ext === ".pdf";

		return isImage || isPdf;
	}

	/**
	 * Upload a file to S3
	 */
	async uploadFile(
		buffer: Buffer,
		fileName: string,
		contentType: string,
		orgId: number,
		projectId: number,
	): Promise<FileMetadata> {
		// Validate file type
		if (!this.validateFileType(contentType, fileName)) {
			throw new Error("Only images and PDF files are allowed");
		}

		// Generate unique key
		const key = this.generateFileKey(orgId, projectId, fileName);

		// Upload to S3
		await storage.putObject({
			key,
			body: buffer,
			contentType,
			contentDisposition: `inline; filename="${fileName}"`,
		});

		// Create metadata in database
		const file = await db.file.createFile({
			key,
			name: fileName,
			size: buffer.length,
			contentType,
			projectId,
		});

		return {
			id: file.id,
			key: file.key,
			name: file.name,
			size: file.size,
			contentType: file.contentType,
			projectId: file.projectId,
			createdAt: file.createdAt,
		};
	}

	/**
	 * Get file metadata by ID
	 */
	async getFileMetadata(fileId: string, projectId: number): Promise<FileMetadata | null> {
		const file = await db.file.getFileById(fileId, projectId);
		return file;
	}

	/**
	 * List all files for a project
	 */
	async listProjectFiles(projectId: number): Promise<FileMetadata[]> {
		const files = await db.file.listProjectFiles(projectId);
		return files;
	}

	/**
	 * Get signed URL for file download/view
	 */
	async getFileUrl(
		fileId: string,
		projectId: number,
		expiresInSeconds: number = 3600,
	): Promise<string | null> {
		const metadata = await this.getFileMetadata(fileId, projectId);
		if (!metadata) {
			return null;
		}

		return storage.createSignedReadUrl(metadata.key, { expiresInSeconds });
	}

	/**
	 * Delete a file
	 */
	async deleteFile(fileId: string, projectId: number): Promise<boolean> {
		const metadata = await this.getFileMetadata(fileId, projectId);
		if (!metadata) {
			return false;
		}

		// Delete from S3
		await storage.deleteObject(metadata.key);

		// Remove metadata from database
		await db.file.deleteFile(fileId, projectId);

		return true;
	}

	async getFileObjectsByIds(fileIds: string[], projectId: number): Promise<FileInput[]> {
		const fileObjects = await Promise.all(
			fileIds.map((fileId) => this.getFileWithBuffer(fileId, projectId)),
		);
		return fileObjects;
	}

	private async getFileWithBuffer(fileId: string, projectId: number): Promise<FileInput> {
		const metadata = await this.getFileMetadata(fileId, projectId);
		if (!metadata) {
			throw new Error("File not found");
		}
		const { stream } = await storage.getObjectStream(metadata.key);
		const buffer = await stream.toArray();

		return {
			id: metadata.id,
			buffer: Buffer.concat(buffer),
			contentType: metadata.contentType,
			fileName: metadata.name,
		};
	}
}

// Export singleton instance
export const fileService = new FileService();
