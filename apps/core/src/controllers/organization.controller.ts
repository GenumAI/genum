import type { Request, Response } from "express";
import { db } from "@/database/db";
import { OrganizationRole } from "@/prisma";
import {
	numberSchema,
	OrganizationMemberInviteSchema,
	stringSchema,
	ProjectCreateSchema,
	OrganizationApiKeyCreateSchema,
	OrganizationUpdateSchema,
	OrganizationUsageStatsSchema,
	CustomProviderApiKeyCreateSchema,
	TestProviderConnectionSchema,
	UpdateCustomModelSchema,
} from "../services/validate";
import { getOrganizationDailyUsageStats } from "../services/logger/logger";
import {
	OrganizationService,
	ProviderNotConfiguredError,
	ProviderNoBaseUrlError,
	ProviderDeleteNotAllowedError,
} from "@/services/organization.service";
import { PromptService } from "@/services/prompt.service";
import { listOpenAICompatibleModels, testProviderConnection } from "@/ai/providers/openai/models";

export class OrganizationController {
	private readonly organizationService: OrganizationService;
	private readonly promptService: PromptService;

	constructor() {
		this.organizationService = new OrganizationService(db);
		this.promptService = new PromptService(db);
	}

	public async getOrganizationDetails(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const organization = await db.organization.getOrganizationById(metadata.orgID);

		res.status(200).json({
			organization,
		});
	}

	public async updateOrganization(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const data = OrganizationUpdateSchema.parse(req.body);

		const updatedOrganization = await db.organization.updateOrganization(metadata.orgID, data);

		res.status(200).json({ organization: updatedOrganization });
	}

	public async getOrganizationMembers(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const members = await db.organization.getOrganizationMembers(metadata.orgID);

		res.status(200).json({
			members,
		});
	}

	public async getOrganizationProjects(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const projects = await db.organization.getOrganizationProjects(metadata.orgID);

		res.status(200).json({
			projects,
		});
	}

	public async createProject(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const data = ProjectCreateSchema.parse(req.body);

		const project = await db.project.createSharedProject(metadata.orgID, data);

		res.status(200).json({
			project,
		});
	}

	public async getMembersNotInProject(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const members = await db.organization.getMembersNotInProject(
			metadata.orgID,
			metadata.projID,
		);

		res.status(200).json({
			members,
		});
	}

	// feature: teamwork
	// public async updateMemberRole(req: Request, res: Response, next: NextFunction) {
	// 	try {
	// 		const metadata = req.genumMeta.ids;
	// 		const memberId = numberSchema.parse(req.params.memberId);
	// 		const { role: newRole } = OrganizationMemberUpdateSchema.parse(req.body);

	// 		// check if member exists
	// 		const member = await db.organization.getMemberById(metadata.orgID, memberId);
	// 		if (!member) {
	// 			res.status(404).json({ error: "Member is not found" });
	// 			return;
	// 		}

	// 		// Check if trying to change role of the last owner
	// 		if (member.role === OrganizationRole.OWNER && newRole === OrganizationRole.READER) {
	// 			const owners = await db.organization.getOrganizationOwners(metadata.orgID);
	// 			if (owners.length <= 1) {
	// 				res.status(400).json({ error: "Cannot change role of the last organization owner" });
	// 				return;
	// 			}
	// 		}

	// 		// update role
	// 		const updatedMember = await db.organization.updateMemberRole(memberId, newRole);

	// 		if (newRole === OrganizationRole.OWNER) {
	// 			// First get all projects in the organization
	// 			const projects = await db.organization.getOrganizationProjects(metadata.orgID);

	// 			// Add member to all projects they're not in
	// 			for (const project of projects) {
	// 				const isMember = await db.project.getMemberByUserId(project.id, member.userId);
	// 				if (!isMember) {
	// 					await db.project.addMember(project.id, member.userId, ProjectRole.OWNER);
	// 				}
	// 			}

	// 			// Then make them owner of all projects
	// 			await db.project.makeAsOwnerForAllProjects(metadata.orgID, memberId);
	// 		}
	// 		else if (newRole === OrganizationRole.READER) {
	// 			// remove from all projects
	// 			await db.project.removeFromAllProjects(metadata.orgID, member.userId);
	// 		}

	// 		res.status(200).json({ member: updatedMember });
	// 	} catch (error) {
	// 		next(error);
	// 	}
	// }

	public async deleteProject(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const projectId = numberSchema.parse(req.params.projectId);

		// check if project is not initial
		const project = await db.project.getProjectByID(projectId);
		if (!project) {
			res.status(404).json({ error: "Project not found" });
			return;
		}
		if (project.initial) {
			res.status(400).json({ error: "Initial project cannot be deleted" });
			return;
		}

		await db.project.deleteProject(projectId, metadata.orgID);
		res.status(200).json({ message: "Project deleted successfully" });
	}

	// feature: teamwork
	// public async deleteMember(req: Request, res: Response, next: NextFunction) {
	// 	try {
	// 		const metadata = req.genumMeta.ids;
	// 		const memberId = numberSchema.parse(req.params.memberId);

	// 		// check if member exists and is not the last owner
	// 		const member = await db.organization.getMemberById(metadata.orgID, memberId);
	// 		if (!member) {
	// 			res.status(404).json({ error: "Member not found" });
	// 			return;
	// 		}

	// 		if (member.role === OrganizationRole.OWNER) {
	// 			const owners = await db.organization.getOrganizationOwners(metadata.orgID);
	// 			if (owners.length <= 1) {
	// 				res.status(400).json({ error: "Cannot delete the last owner" });
	// 				return;
	// 			}
	// 		}

	// 		// check if member is not deletes himself
	// 		if (member.userId === metadata.userID) {
	// 			res.status(400).json({ error: "You cannot delete yourself" });
	// 			return;
	// 		}

	// 		await db.project.removeFromAllProjects(metadata.orgID, member.userId);

	// 		await db.organization.deleteMember(memberId);

	// 		res.status(200).json({ message: "Member deleted successfully" });
	// 	} catch (error) {
	// 		next(error);
	// 	}
	// }

	public async inviteMember(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const { email } = OrganizationMemberInviteSchema.parse(req.body);
		const org = req.genumMeta.organization;

		const { invitation, inviteUrl } = await this.organizationService.createMemberInvitation(
			metadata.orgID,
			email,
			OrganizationRole.ADMIN,
			org.name,
		);

		res.status(200).json({
			invitation,
			inviteUrl,
		});
	}

	public async deleteOrganizationInvite(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const token = stringSchema.parse(req.params.token);

		// Check if invite exists and belongs to the organization
		const invite = await db.organization.getInvitationByToken(token);
		if (!invite) {
			res.status(404).json({ error: "Invitation not found" });
			return;
		}

		if (invite.organizationId !== metadata.orgID) {
			res.status(403).json({ error: "Not authorized to delete this invitation" });
			return;
		}

		await db.organization.deleteInvitation(token);
		res.status(200).json({ message: "Invitation deleted successfully" });
	}

	public async getOrganizationInvites(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const invites = await db.organization.getOrganizationInvites(metadata.orgID);

		res.status(200).json({
			invites,
		});
	}

	public async getOrganizationApiKeys(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const keys = await db.organization.getOrganizationApiKeys(metadata.orgID);

		res.status(200).json({
			keys,
		});
	}

	public async addOrganizationApiKey(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const { vendor, key } = OrganizationApiKeyCreateSchema.parse(req.body);

		const apiKey = await db.organization.addOrganizationApiKey(metadata.orgID, vendor, key);

		res.status(200).json({
			id: apiKey.id,
			vendor: apiKey.vendor,
			publicKey: apiKey.publicKey,
			createdAt: apiKey.createdAt,
			updatedAt: apiKey.updatedAt,
		});
	}

	public async deleteOrganizationApiKey(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const id = numberSchema.parse(req.params.id);

		await db.organization.deleteOrganizationApiKey(metadata.orgID, id);

		res.status(200).json({
			message: "API key deleted successfully",
		});
	}

	public async getProjectKeys(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const keys = await db.project.getProjectApiKeysByOrganizationId(metadata.orgID);

		res.status(200).json({
			keys,
		});
	}

	public async getOrganizationDailyUsageStats(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const { fromDate, toDate, projectId } = OrganizationUsageStatsSchema.parse(req.query);
		let projectIds: number[];

		if (projectId) {
			projectIds = [Number(projectId)];
		} else {
			const projects = await db.organization.getOrganizationProjects(metadata.orgID);
			projectIds = (projects as Array<{ id: number }>).map((p) => p.id);
		}

		const stats = await getOrganizationDailyUsageStats(
			metadata.orgID,
			projectIds,
			fromDate,
			toDate,
		);
		res.status(200).json(stats);
	}

	public async getOrganizationQuota(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const quotaFull = await db.organization.getQuotaByOrgId(metadata.orgID);
		if (!quotaFull) {
			res.status(404).json({ error: "Quota not found" });
			return;
		}

		const quota = {
			balance: quotaFull.balance,
		};
		res.status(200).json({
			quota,
		});
	}

	// ==================== Custom Provider Endpoints ====================

	/**
	 * Test connection to a custom OpenAI-compatible provider
	 * POST /api/organization/providers/test
	 */
	public async testCustomProviderConnection(req: Request, res: Response) {
		const { apiKey, baseUrl } = TestProviderConnectionSchema.parse(req.body);

		const isConnected = await testProviderConnection(apiKey, baseUrl);

		if (!isConnected) {
			res.status(400).json({
				success: false,
				error: "Failed to connect to provider. Check API key and URL.",
			});
			return;
		}

		// Also fetch models to show what's available
		const result = await listOpenAICompatibleModels(apiKey, baseUrl);

		res.status(200).json({
			success: true,
			models: result.models,
		});
	}

	/**
	 * Create or update the custom OpenAI-compatible provider (only one per org)
	 * POST /api/organization/provider
	 */
	public async upsertCustomProvider(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const data = CustomProviderApiKeyCreateSchema.parse(req.body);

		// Test connection first
		const isConnected = await testProviderConnection(data.key || "", data.baseUrl);
		if (!isConnected) {
			res.status(400).json({
				error: "Failed to connect to provider. Check API key and URL.",
			});
			return;
		}

		const modelsResult = await listOpenAICompatibleModels(data.key || "", data.baseUrl);
		if (modelsResult.error) {
			res.status(400).json({
				error: modelsResult.error,
			});
			return;
		}

		const provider = await db.organization.upsertCustomProvider(metadata.orgID, data);

		await this.organizationService.syncProviderModels(
			metadata.orgID,
			provider.id,
			modelsResult.models.map((model) => ({
				name: model.id,
				displayName: model.name,
			})),
		);

		res.status(200).json({
			provider: {
				id: provider.id,
				name: provider.name,
				baseUrl: provider.baseUrl,
				publicKey: provider.publicKey,
				createdAt: provider.createdAt,
				updatedAt: provider.updatedAt,
			},
		});
	}

	/**
	 * Get the custom provider for the organization (if exists)
	 * GET /api/organization/provider
	 */
	public async getCustomProvider(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const provider = await db.organization.getCustomProvider(metadata.orgID);

		res.status(200).json({ provider });
	}

	/**
	 * Delete the custom OpenAI-compatible provider
	 * DELETE /api/organization/provider
	 */
	public async deleteCustomProvider(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		try {
			const deleted = await this.organizationService.deleteCustomProvider(metadata.orgID);
			if (!deleted) {
				res.status(404).json({ error: "Custom provider not configured" });
				return;
			}

			res.status(200).json({ message: "Custom provider deleted successfully" });
		} catch (e) {
			if (e instanceof ProviderDeleteNotAllowedError) {
				res.status(409).json({
					error: e.message,
					promptUsageCount: e.promptUsageCount,
					productiveCommitUsageCount: e.productiveCommitUsageCount,
				});
				return;
			}

			throw e;
		}
	}

	/**
	 * Check if the custom provider can be deleted
	 * GET /api/organization/provider/delete-status
	 */
	public async getCustomProviderDeleteStatus(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const status = await this.organizationService.getCustomProviderDeleteStatus(metadata.orgID);
		if (!status) {
			res.status(404).json({ error: "Custom provider not configured" });
			return;
		}

		res.status(200).json({ status });
	}

	/**
	 * Sync models from the custom provider to the database
	 * POST /api/organization/provider/models/sync
	 */
	public async syncProviderModels(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		try {
			const provider = await this.organizationService.getValidatedCustomProvider(
				metadata.orgID,
			);

			// Fetch models from provider
			const result = await listOpenAICompatibleModels(provider.key, provider.baseUrl);

			if (result.error) {
				res.status(400).json({ error: result.error });
				return;
			}

			// Sync to database
			const syncResult = await this.organizationService.syncProviderModels(
				metadata.orgID,
				provider.id,
				result.models.map((m) => ({ name: m.id, displayName: m.name })),
			);

			res.status(200).json({
				message: "Models synced successfully",
				...syncResult,
			});
		} catch (e) {
			if (e instanceof ProviderNotConfiguredError) {
				res.status(404).json({ error: e.message });
				return;
			}
			if (e instanceof ProviderNoBaseUrlError) {
				res.status(400).json({ error: e.message });
				return;
			}
			throw e;
		}
	}

	/**
	 * Get synced models for the custom provider
	 * GET /api/organization/provider/models
	 */
	public async getProviderModels(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const provider = await db.organization.getCustomProvider(metadata.orgID);
		if (!provider) {
			res.status(404).json({ error: "Custom provider not configured" });
			return;
		}

		const providerWithModels = await db.organization.getApiKeyWithModels(
			metadata.orgID,
			provider.id,
		);

		res.status(200).json({
			provider: {
				id: provider.id,
				name: provider.name,
				baseUrl: provider.baseUrl,
			},
			models: providerWithModels?.languageModels || [],
		});
	}

	/**
	 * Update a custom model's configuration
	 * PATCH /api/organization/models/:id
	 */
	public async updateCustomModel(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const modelId = numberSchema.parse(req.params.id);
		const data = UpdateCustomModelSchema.parse(req.body);

		// Check if model exists and belongs to this organization
		const existingModel = await db.organization.getCustomModelById(metadata.orgID, modelId);
		if (!existingModel) {
			res.status(404).json({ error: "Model not found or not a custom model" });
			return;
		}

		const updatedModel = await db.organization.updateCustomModel(modelId, data);

		if (data.parametersConfig !== undefined) {
			await this.promptService.reindexPromptsForCustomModel({
				orgId: metadata.orgID,
				modelId,
				modelName: updatedModel.name,
				vendor: updatedModel.vendor,
				parametersConfig: updatedModel.parametersConfig as Record<string, unknown> | null,
			});
		}

		res.status(200).json({ model: updatedModel });
	}
}
