import { Router } from "express";
import { ApiV1Controller } from "../controllers/apiv1.controller";
import { asyncHandler } from "@/utils/asyncHandler";

export function createApiV1Router(): Router {
	const router = Router();
	const controller = new ApiV1Controller();

	// API V1
	// prompts
	router.get("/prompts", asyncHandler(controller.listPrompts.bind(controller)));
	router.post("/prompts", asyncHandler(controller.createPrompt.bind(controller)));
	router.get("/prompts/:id", asyncHandler(controller.getPrompt.bind(controller)));
	router.post("/prompts/run", asyncHandler(controller.runPrompt.bind(controller)));
	// Before `/prompts/:id`-shaped routes would matter, but after `/prompts/run` for the
	// same reason that one is where it is: Express matches in order, and `run` would
	// otherwise be read as an id.
	router.post("/prompts/:id/render", asyncHandler(controller.renderPrompt.bind(controller)));

	return router;
}
