import { Router } from "express";
import { OrganizationRole } from "@/prisma";
import { createAuthMiddleware } from "../auth/wizard";
import { OrganizationController } from "../controllers/organization.controller";
import { asyncHandler } from "@/utils/asyncHandler";

export function createOrganizationRouter(): Router {
	const w = createAuthMiddleware();
	const router = Router();
	const orgController = new OrganizationController();

	// Routes accessible to any org member (no role restriction)
	router.get("/", asyncHandler(orgController.getOrganizationDetails.bind(orgController)));

	// ------------ All routes below require at least ADMIN ------------
	router.use(w.hasMinOrgRole(OrganizationRole.ADMIN));

	// Organization
	router.put("/", asyncHandler(orgController.updateOrganization.bind(orgController)));

	// Members
	router.put(
		"/members/:memberId/role",
		asyncHandler(orgController.updateMemberRole.bind(orgController)),
	);
	router.delete(
		"/members/:memberId",
		asyncHandler(orgController.deleteMember.bind(orgController)),
	);
	router.get(
		"/members/not-in-project",
		w.attachProjContext,
		asyncHandler(orgController.getMembersNotInProject.bind(orgController)),
	);
	router.get("/members", asyncHandler(orgController.getOrganizationMembers.bind(orgController)));
	router.post("/members/invite", asyncHandler(orgController.inviteMember.bind(orgController)));

	// Invites
	router.get("/invites", asyncHandler(orgController.getOrganizationInvites.bind(orgController)));
	router.delete(
		"/invites/:token",
		asyncHandler(orgController.deleteOrganizationInvite.bind(orgController)),
	);

	// Projects
	router.post("/projects", asyncHandler(orgController.createProject.bind(orgController)));
	router.get(
		"/projects",
		w.attachProjContext,
		asyncHandler(orgController.getOrganizationProjects.bind(orgController)),
	);
	router.delete(
		"/projects/:projectId",
		w.attachProjContext,
		asyncHandler(orgController.deleteProject.bind(orgController)),
	);

	// API Keys
	router.get("/api-keys", asyncHandler(orgController.getOrganizationApiKeys.bind(orgController)));
	router.post("/api-keys", asyncHandler(orgController.addOrganizationApiKey.bind(orgController)));
	router.delete(
		"/api-keys/:id",
		asyncHandler(orgController.deleteOrganizationApiKey.bind(orgController)),
	);
	router.get("/project-keys", asyncHandler(orgController.getProjectKeys.bind(orgController)));

	// Custom Provider (OpenAI-compatible) - only one per organization
	router.post(
		"/provider/test",
		asyncHandler(orgController.testCustomProviderConnection.bind(orgController)),
	);
	router.get("/provider", asyncHandler(orgController.getCustomProvider.bind(orgController)));
	router.get(
		"/provider/delete-status",
		asyncHandler(orgController.getCustomProviderDeleteStatus.bind(orgController)),
	);
	router.post("/provider", asyncHandler(orgController.upsertCustomProvider.bind(orgController)));
	router.delete(
		"/provider",
		asyncHandler(orgController.deleteCustomProvider.bind(orgController)),
	);
	router.post(
		"/provider/models/sync",
		asyncHandler(orgController.syncProviderModels.bind(orgController)),
	);
	router.get(
		"/provider/models",
		asyncHandler(orgController.getProviderModels.bind(orgController)),
	);

	// Models
	router.patch("/models/:id", asyncHandler(orgController.updateCustomModel.bind(orgController)));
	router.get("/models", asyncHandler(orgController.getOrganizationModels.bind(orgController)));
	router.patch(
		"/models/:id/toggle",
		asyncHandler(orgController.toggleOrganizationModel.bind(orgController)),
	);
	router.get("/models/:id/usage", asyncHandler(orgController.getModelUsage.bind(orgController)));

	// Quota & Usage
	router.get("/quota", asyncHandler(orgController.getOrganizationQuota.bind(orgController)));
	router.get(
		"/usage",
		asyncHandler(orgController.getOrganizationDailyUsageStats.bind(orgController)),
	);

	return router;
}
