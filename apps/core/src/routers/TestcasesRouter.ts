import { Router } from "express";
import { TestcasesController } from "../controllers/testcase.controller";
import { asyncHandler } from "@/utils/asyncHandler";

export function createTestcasesRouter(): Router {
	const router = Router();
	const controller = new TestcasesController();

	// Run Testcase
	router.post("/:id/run", asyncHandler(controller.runTestcase.bind(controller)));

	// Testcases
	router.get("/", asyncHandler(controller.getAllTestcases.bind(controller)));
	router.post("/", asyncHandler(controller.createTestcase.bind(controller)));

	router.get("/:id", asyncHandler(controller.getTestcaseById.bind(controller)));
	router.delete("/:id", asyncHandler(controller.deleteTestcase.bind(controller)));
	router.put("/:id", asyncHandler(controller.updateTestcase.bind(controller)));

	// Testcase files
	router.post("/:id/files", asyncHandler(controller.addFileToTestcase.bind(controller)));
	router.delete(
		"/:id/files/:fileId",
		asyncHandler(controller.removeFileFromTestcase.bind(controller)),
	);

	return router;
}
