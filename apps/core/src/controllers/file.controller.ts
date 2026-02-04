import type { Request, Response } from "express";
import { fileService } from "../services/file.service";
import multer from "multer";

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 50 * 1024 * 1024, // 50MB limit
	},
});

export class FileController {
	// Middleware to handle file upload
	public uploadMiddleware = upload.single("file");

	/**
	 * Upload a file
	 */
	public async uploadFile(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const file = (req as Request & { file?: Express.Multer.File }).file;

		if (!file) {
			return res.status(400).json({ error: "No file provided" });
		}

		try {
			const fileMetadata = await fileService.uploadFile(
				file.buffer,
				file.originalname,
				file.mimetype,
				metadata.orgID,
				metadata.projID,
			);

			res.status(201).json({ file: fileMetadata });
		} catch (error: unknown) {
			res.status(400).json({
				error: error instanceof Error ? error.message : "Failed to upload file",
			});
		}
	}

	/**
	 * List all files for a project
	 */
	public async listFiles(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		try {
			const files = await fileService.listProjectFiles(metadata.projID);
			res.status(200).json({ files });
		} catch (error: unknown) {
			res.status(500).json({
				error: error instanceof Error ? error.message : "Failed to list files",
			});
		}
	}

	/**
	 * Get file download URL
	 */
	public async getFileUrl(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const fileId = req.params.fileId as string;
		const expiresIn = req.query.expiresIn ? parseInt(req.query.expiresIn as string, 10) : 3600;

		try {
			const url = await fileService.getFileUrl(fileId, metadata.projID, expiresIn);
			if (!url) {
				return res.status(404).json({ error: "File not found" });
			}

			res.status(200).json({ url });
		} catch (error: unknown) {
			res.status(500).json({
				error: error instanceof Error ? error.message : "Failed to get file URL",
			});
		}
	}

	/**
	 * Delete a file
	 */
	public async deleteFile(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const fileId = req.params.fileId as string;

		try {
			const deleted = await fileService.deleteFile(fileId, metadata.projID);
			if (!deleted) {
				return res.status(404).json({ error: "File not found" });
			}

			res.status(200).json({ message: "File deleted successfully" });
		} catch (error: unknown) {
			res.status(500).json({
				error: error instanceof Error ? error.message : "Failed to delete file",
			});
		}
	}
}
