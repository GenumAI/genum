import { Router } from "express";
import { FileController } from "../controllers/file.controller";
import { asyncHandler } from "@/utils/asyncHandler";

export function createFileRouter(): Router {
	const router = Router();
	const fileController = new FileController();

	// Upload file
	router.post(
		"/",
		fileController.uploadMiddleware,
		asyncHandler(fileController.uploadFile.bind(fileController)),
	);

	// List files
	router.get("/", asyncHandler(fileController.listFiles.bind(fileController)));

	// Get file URL
	router.get("/:fileId/url", asyncHandler(fileController.getFileUrl.bind(fileController)));

	// Delete file
	router.delete("/:fileId", asyncHandler(fileController.deleteFile.bind(fileController)));

	return router;
}
