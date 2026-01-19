import type { Database } from "@/database/db";
import { ProjectRole, OrganizationRole } from "@/prisma";
import { webhooks } from "./webhooks/webhooks";
import { env } from "@/env";

// Custom errors for provider operations
export class ProviderNotConfiguredError extends Error {
	constructor() {
		super("Custom provider not configured");
		this.name = "ProviderNotConfiguredError";
	}
}

export class ProviderNoBaseUrlError extends Error {
	constructor() {
		super("Provider has no base URL configured");
		this.name = "ProviderNoBaseUrlError";
	}
}

export class ProviderDeleteNotAllowedError extends Error {
	public readonly promptUsageCount: number;
	public readonly productiveCommitUsageCount: number;

	constructor(promptUsageCount: number, productiveCommitUsageCount: number) {
		super("Custom provider cannot be deleted while it is in use");
		this.name = "ProviderDeleteNotAllowedError";
		this.promptUsageCount = promptUsageCount;
		this.productiveCommitUsageCount = productiveCommitUsageCount;
	}
}

export type ProviderModelInput = {
	name: string;
	displayName?: string;
};

export type SyncProviderModelsResult = {
	created: number;
	existing: number;
};

export type ValidatedProvider = {
	id: number;
	key: string;
	baseUrl: string;
	name: string | null;
};

export class OrganizationService {
	constructor(private readonly db: Database) {}

	private async getCustomProviderDeleteInfo(orgId: number) {
		const provider = await this.db.organization.getCustomProvider(orgId);
		if (!provider) {
			return {
				provider: null,
				modelIds: [],
				promptUsageCount: 0,
				productiveCommitUsageCount: 0,
				canDelete: false,
			};
		}

		const modelIds = await this.db.organization.getCustomProviderModelIds(provider.id);
		const promptUsageCount = await this.db.prompts.countPromptsUsingLanguageModels(
			orgId,
			modelIds,
		);
		const productiveCommitUsageCount =
			await this.db.prompts.countProductiveCommitsUsingLanguageModels(orgId, modelIds);

		return {
			provider,
			modelIds,
			promptUsageCount,
			productiveCommitUsageCount,
			canDelete: promptUsageCount === 0 && productiveCommitUsageCount === 0,
		};
	}

	/**
	 * Get custom provider with validated baseUrl
	 * @throws ProviderNotConfiguredError if provider doesn't exist
	 * @throws ProviderNoBaseUrlError if provider has no baseUrl
	 */
	public async getValidatedCustomProvider(orgId: number): Promise<ValidatedProvider> {
		const provider = await this.db.organization.getCustomProvider(orgId);

		if (!provider) {
			throw new ProviderNotConfiguredError();
		}

		if (!provider.baseUrl) {
			throw new ProviderNoBaseUrlError();
		}

		return {
			id: provider.id,
			key: provider.key,
			baseUrl: provider.baseUrl,
			name: provider.name,
		};
	}

	public async deleteCustomProvider(orgId: number) {
		const deleteInfo = await this.getCustomProviderDeleteInfo(orgId);
		if (!deleteInfo.provider) {
			return null;
		}
		if (!deleteInfo.canDelete) {
			throw new ProviderDeleteNotAllowedError(
				deleteInfo.promptUsageCount,
				deleteInfo.productiveCommitUsageCount,
			);
		}

		const defaultModel = await this.db.prompts.getDefaultLanguageModelForReset();

		await this.db.organization.runTransaction([
			this.db.organization.resetPromptsToDefaultModel(
				deleteInfo.modelIds,
				defaultModel.id,
				defaultModel.config,
			),
			this.db.organization.resetPromptVersionsToDefaultModel(
				deleteInfo.modelIds,
				defaultModel.id,
				defaultModel.config,
			),
			this.db.organization.deleteLanguageModelsByApiKey(deleteInfo.provider.id),
			this.db.organization.deleteOrganizationApiKeyById(deleteInfo.provider.id),
		]);

		return deleteInfo.provider;
	}

	public async getCustomProviderDeleteStatus(orgId: number) {
		const deleteInfo = await this.getCustomProviderDeleteInfo(orgId);
		if (!deleteInfo.provider) {
			return null;
		}

		return {
			canDelete: deleteInfo.canDelete,
			promptUsageCount: deleteInfo.promptUsageCount,
			productiveCommitUsageCount: deleteInfo.productiveCommitUsageCount,
		};
	}

	/**
	 * Sync models from a custom provider to the database
	 * Creates new models, keeps existing ones, optionally removes stale ones
	 */
	public async syncProviderModels(
		orgId: number,
		apiKeyId: number,
		models: ProviderModelInput[],
	): Promise<SyncProviderModelsResult> {
		const apiKey = await this.db.organization.getApiKeyWithModels(orgId, apiKeyId);

		if (!apiKey) {
			throw new Error("API key not found");
		}

		const existingModelNames = new Set(apiKey.languageModels.map((model) => model.name));

		let created = 0;
		let existing = 0;

		for (const model of models) {
			if (!existingModelNames.has(model.name)) {
				await this.db.organization.createLanguageModel({
					name: model.name,
					displayName: model.displayName || model.name,
					vendor: apiKey.vendor,
					apiKeyId: apiKey.id,
					promptPrice: 0,
					completionPrice: 0,
					contextTokensMax: 0,
					completionTokensMax: 0,
					description: `Model from ${apiKey.name || "custom provider"}`,
				});
				created++;
			} else {
				existing++;
			}
		}

		return { created, existing };
	}

	public async addOrganizationMember(orgId: number, userId: number, role: OrganizationRole) {
		// check if user is already a member
		const existingMember = await this.db.organization.getMemberByUserId(orgId, userId);
		if (existingMember) {
			throw new Error("User is already a member of the organization");
		}

		const member = await this.db.organization.addMemberToOrganization(orgId, userId, role);

		// if role is ADMIN - all projects are visible
		if (role === OrganizationRole.ADMIN) {
			await this.syncProjectMembershipByOrganizationRole(orgId, userId);
		}

		return member;
	}

	private async syncProjectMembershipByOrganizationRole(orgId: number, userId: number) {
		const projects = await this.db.project.getProjectsByOrgId(orgId);
		for (const project of projects) {
			await this.db.project.addMember(project.id, userId, ProjectRole.OWNER);
		}
	}

	public async createMemberInvitation(
		orgId: number,
		email: string,
		_role: OrganizationRole,
		orgName: string,
	) {
		// Check if user is already a member
		const existingMember = await this.db.organization.getMemberByEmail(orgId, email);
		if (existingMember) {
			throw new Error("User is already a member");
		}

		// feature: teamwork
		const USER_ROLE = OrganizationRole.ADMIN;
		const invitation = await this.db.organization.inviteMember(orgId, email, USER_ROLE);

		const inviteUrl = `${process.env.FRONTEND_URL}/invite/${invitation.token}`;

		// send email with token if instance is cloud
		if (env.INSTANCE_TYPE === "cloud") {
			await webhooks.sendEmail(email, inviteUrl, orgName);
		}

		return {
			invitation,
			inviteUrl,
		};
	}
}
