import { Router } from "express";
import { OrganizationRole } from "@/prisma";
import { createAuthMiddleware } from "../auth/wizard";
import { OrganizationController } from "../controllers/organization.controller";
import { asyncHandler } from "@/utils/asyncHandler";

export function createOrganizationRouter(): Router {
	const w = createAuthMiddleware();
	const router = Router();
	const orgController = new OrganizationController();

	// Members
	// router.put('/members/:memberId/role', w.hasOrganizationRole(OrganizationRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
	// 	orgController.updateMemberRole(req, res, next);
	// });
	router.get(
		"/members/not-in-project",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		w.attachProjContext(),
		asyncHandler(orgController.getMembersNotInProject.bind(orgController)),
	);
	// router.delete('/members/:memberId', w.hasOrganizationRole(OrganizationRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
	// 	orgController.deleteMember(req, res, next);
	// });
	router.get(
		"/members",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.getOrganizationMembers.bind(orgController)),
	);
	router.post(
		"/members/invite",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.inviteMember.bind(orgController)),
	);

	// Invites
	router.get(
		"/invites",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.getOrganizationInvites.bind(orgController)),
	);
	router.delete(
		"/invites/:token",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.deleteOrganizationInvite.bind(orgController)),
	);

	// Projects
	router.post(
		"/projects",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.createProject.bind(orgController)),
	);
	router.get(
		"/projects",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		w.attachProjContext(),
		asyncHandler(orgController.getOrganizationProjects.bind(orgController)),
	);
	router.delete(
		"/projects/:projectId",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		w.attachProjContext(),
		asyncHandler(orgController.deleteProject.bind(orgController)),
	);

	// API Keys
	router.get(
		"/api-keys",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.getOrganizationApiKeys.bind(orgController)),
	);
	router.post(
		"/api-keys",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.addOrganizationApiKey.bind(orgController)),
	);
	router.delete(
		"/api-keys/:id",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.deleteOrganizationApiKey.bind(orgController)),
	);

	router.get(
		"/project-keys",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.getProjectKeys.bind(orgController)),
	);

	// Custom Provider (OpenAI-compatible) - only one per organization
	router.post(
		"/provider/test",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.testCustomProviderConnection.bind(orgController)),
	);
	router.get(
		"/provider",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.getCustomProvider.bind(orgController)),
	);
	router.get(
		"/provider/delete-status",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.getCustomProviderDeleteStatus.bind(orgController)),
	);
	router.post(
		"/provider",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.upsertCustomProvider.bind(orgController)),
	);
	router.delete(
		"/provider",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.deleteCustomProvider.bind(orgController)),
	);
	router.post(
		"/provider/models/sync",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.syncProviderModels.bind(orgController)),
	);
	router.get(
		"/provider/models",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.getProviderModels.bind(orgController)),
	);

	// Custom model management
	router.patch(
		"/models/:id",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.updateCustomModel.bind(orgController)),
	);

	// Quota
	router.get(
		"/quota",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.getOrganizationQuota.bind(orgController)),
	);

	// Organization
	router.get(
		"/usage",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.getOrganizationDailyUsageStats.bind(orgController)),
	);

	// Organization
	router.get("/", asyncHandler(orgController.getOrganizationDetails.bind(orgController)));
	router.put(
		"/",
		w.hasOrganizationRole(OrganizationRole.ADMIN),
		asyncHandler(orgController.updateOrganization.bind(orgController)),
	);

	return router;
}
