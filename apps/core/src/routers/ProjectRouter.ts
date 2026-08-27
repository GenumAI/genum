import { Router } from "express";
import { ProjectRole } from "@/prisma";
import { ProjectController } from "../controllers/project.controller";
import { createAuthMiddleware } from "../auth/wizard";
import { asyncHandler } from "@/utils/asyncHandler";

export function createProjectRouter(): Router {
	const w = createAuthMiddleware();
	const router = Router();
	const projectController = new ProjectController();

	// Members
	router.put(
		"/members/:memberId/role",
		w.hasMinProjectRole(ProjectRole.ADMIN),
		asyncHandler(projectController.updateProjectMemberRole.bind(projectController)),
	);
	router.post(
		"/members",
		w.hasMinProjectRole(ProjectRole.ADMIN),
		asyncHandler(projectController.addProjectMember.bind(projectController)),
	);
	router.delete(
		"/members/:memberId",
		w.hasMinProjectRole(ProjectRole.ADMIN),
		asyncHandler(projectController.deleteProjectMember.bind(projectController)),
	);
	router.get(
		"/members",
		asyncHandler(projectController.getProjectMembers.bind(projectController)),
	);

	// Api keys
	router.get(
		"/api-keys",
		asyncHandler(projectController.getProjectApiKeys.bind(projectController)),
	);
	// Minting and revoking project API keys is an admin action: these keys
	// authenticate the public API. Listing stays open -- it exposes only publicKey.
	router.post(
		"/api-keys",
		w.hasMinProjectRole(ProjectRole.ADMIN),
		asyncHandler(projectController.createProjectApiKey.bind(projectController)),
	);
	router.delete(
		"/api-keys/:apiKeyId",
		w.hasMinProjectRole(ProjectRole.ADMIN),
		asyncHandler(projectController.deleteProjectApiKey.bind(projectController)),
	);

	// Project
	router.get("/", asyncHandler(projectController.getProjectDetails.bind(projectController)));
	router.put(
		"/",
		w.hasMinProjectRole(ProjectRole.ADMIN),
		asyncHandler(projectController.updateProject.bind(projectController)),
	);

	// Usage Statistics
	// router.get('/usage', async (req: Request, res: Response, next: NextFunction) => {
	// 	projectController.getProjectDetailedUsageStats(req, res, next);
	// });

	// Usage Statistics V2 (with daily breakdown)
	router.get(
		"/usage_v2",
		asyncHandler(projectController.getProjectDetailedUsageStats.bind(projectController)),
	);

	// Logs
	router.get("/logs", asyncHandler(projectController.getProjectLogs.bind(projectController)));

	return router;
}
