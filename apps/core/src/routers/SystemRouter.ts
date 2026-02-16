import { Router } from "express";
import { SystemController } from "@/controllers/system.controller";
import { asyncHandler } from "@/utils/asyncHandler";

export function createSystemRouter(): Router {
	const router = Router();
	const systemController = new SystemController();

	// create new organization (system user only)
	router.post(
		"/organizations",
		asyncHandler(systemController.createOrganization.bind(systemController)),
	);

	return router;
}
