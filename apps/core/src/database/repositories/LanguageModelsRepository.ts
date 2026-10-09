import { AiVendor, type PrismaClient } from "@/prisma";
import type { Prisma } from "@/prisma";
import { ModelConfigService } from "../../ai/models/modelConfigService";
import type { LanguageModelData } from "../seed/models";
import type { ModelConfigParameters } from "@/ai/models/types";

type DefaultLanguageModel = {
	id: number;
	name: string;
	vendor: AiVendor;
	config: ModelConfigParameters;
};

// Resolved override for prompt creation: an explicit model + already-sanitized
// config, computed by the caller (see PromptService.resolvePromptModelOverride)
// before newProjectPrompt is invoked.
export type NewPromptModelOverride = {
	languageModelId: number;
	languageModelConfig: ModelConfigParameters;
};

export class LanguageModelsRepository {
	private prisma: PrismaClient;
	private modelConfigService = new ModelConfigService();

	// Кеш для дефолтной модели
	private defaultLanguageModel: DefaultLanguageModel | null = null;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	// get default language model from database with caching
	private async getDefaultLanguageModel(): Promise<DefaultLanguageModel> {
		// return from cache if already loaded
		if (this.defaultLanguageModel) {
			return this.defaultLanguageModel;
		}

		// search model by ID=1 (default in Prisma schema)
		// if not found, search by name and vendor as fallback
		let model = await this.prisma.languageModel.findUnique({
			where: { id: 1 },
		});

		// Fallback: search by name and vendor (in case ID changed)
		if (!model) {
			model = await this.prisma.languageModel.findFirst({
				where: {
					vendor: AiVendor.OPENAI,
					name: "gpt-4o",
					apiKeyId: null,
				},
			});
		}

		if (!model) {
			throw new Error("Default language model not found in database");
		}

		// get default config for model
		const config = this.modelConfigService.getDefaultValues(model.name, model.vendor);

		// cache the result
		this.defaultLanguageModel = {
			id: model.id,
			name: model.name,
			vendor: model.vendor,
			config,
		};

		return this.defaultLanguageModel;
	}

	/**
	 * clear default language model cache.
	 * useful for tests or when model was changed in database.
	 */
	public clearDefaultLanguageModelCache(): void {
		this.defaultLanguageModel = null;
	}

	// PromptsRepository.newProjectPrompt falls back to this when the caller pins no model
	public async getDefaultModelOverride(): Promise<NewPromptModelOverride> {
		const defaultModel = await this.getDefaultLanguageModel();
		return { languageModelId: defaultModel.id, languageModelConfig: defaultModel.config };
	}

	// expose default language model config for callers that need a reset baseline
	public async getDefaultLanguageModelForReset(): Promise<{
		id: number;
		config: ModelConfigParameters;
	}> {
		const defaultModel = await this.getDefaultLanguageModel();
		return {
			id: defaultModel.id,
			config: defaultModel.config,
		};
	}

	/**
	 * Full row for the default language model — used when a caller supplies a
	 * `languageModelConfig` to sanitize without naming a specific model.
	 */
	public async getDefaultLanguageModelRow() {
		const defaultModel = await this.getDefaultLanguageModel();
		const row = await this.prisma.languageModel.findUnique({
			where: { id: defaultModel.id },
		});
		if (!row) {
			throw new Error("Default language model not found in database");
		}
		return row;
	}

	public async getModels() {
		return await this.prisma.languageModel.findMany();
	}

	public async getModelsByOrganization(orgId: number) {
		return await this.prisma.languageModel.findMany({
			where: {
				OR: [{ apiKeyId: null }, { apiKey: { organizationId: orgId } }],
			},
		});
	}

	public async createModel(model: LanguageModelData) {
		// todo: refactor
		return await this.prisma.languageModel.create({
			data: {
				name: model.name,
				displayName: model.displayName,
				vendor: model.vendor,
				promptPrice: model.promptPrice,
				completionPrice: model.completionPrice,
				contextTokensMax: model.contextTokensMax,
				completionTokensMax: model.completionTokensMax,
				description: model.description,
			},
		});
	}

	public async updateModel(model: LanguageModelData) {
		return await this.prisma.languageModel.updateMany({
			where: {
				vendor: model.vendor,
				name: model.name,
				apiKeyId: null,
			},
			data: {
				displayName: model.displayName,
				promptPrice: model.promptPrice,
				completionPrice: model.completionPrice,
				contextTokensMax: model.contextTokensMax,
				completionTokensMax: model.completionTokensMax,
				description: model.description,
			},
		});
	}

	public async getModelConfig(name: string, vendor: AiVendor, dbParametersConfig?: unknown) {
		const modelConfigService = new ModelConfigService();

		// For custom providers, use database config if available
		if (vendor === AiVendor.CUSTOM_OPENAI_COMPATIBLE) {
			return modelConfigService.getCustomModelConfig(
				name,
				dbParametersConfig as Record<string, unknown> | null | undefined,
			);
		}

		return modelConfigService.getLLMConfig(name, vendor);
	}

	public async getModelById(id: number) {
		return await this.prisma.languageModel.findUnique({
			where: { id },
		});
	}

	public async getLanguageModelById(modelId: number) {
		return await this.prisma.languageModel.findUnique({
			where: { id: modelId },
			include: {
				apiKey: {
					select: {
						organizationId: true,
					},
				},
			},
		});
	}

	// ==================== Custom Provider Models ====================

	/**
	 * Get a custom model by ID (with organization ownership check via apiKey)
	 */
	public async getCustomModelById(orgId: number, modelId: number) {
		const model = await this.prisma.languageModel.findUnique({
			where: { id: modelId },
			include: { apiKey: true },
		});

		if (!model || !model.apiKey || model.apiKey.organizationId !== orgId) {
			return null;
		}

		return model;
	}

	/**
	 * Create a language model (custom provider models)
	 */
	public async createLanguageModel(data: Prisma.LanguageModelUncheckedCreateInput) {
		return await this.prisma.languageModel.create({ data });
	}

	/**
	 * Delete a language model by ID
	 */
	public async deleteLanguageModelById(modelId: number) {
		return await this.prisma.languageModel.delete({ where: { id: modelId } });
	}

	public deleteLanguageModelsByApiKey(apiKeyId: number) {
		return this.prisma.languageModel.deleteMany({ where: { apiKeyId } });
	}

	// ==================== Organization Models Management ====================

	/**
	 * Get all available models for an organization (excluding disabled ones)
	 * Returns both global models and organization's custom models
	 */
	public async getAvailableModels(orgId: number) {
		// Get all models (global + custom for this org)
		const allModels = await this.prisma.languageModel.findMany({
			where: {
				OR: [
					{ apiKeyId: null }, // Global models
					{ apiKey: { organizationId: orgId } }, // Custom models for this org
				],
			},
			orderBy: [{ vendor: "asc" }, { name: "asc" }],
		});

		// Get disabled models for this organization
		const disabledModels = await this.prisma.organizationDisabledModel.findMany({
			where: { organizationId: orgId },
			select: { modelId: true },
		});

		const disabledIds = new Set(disabledModels.map((d) => d.modelId));

		// Filter out disabled models
		return allModels.filter((model) => !disabledIds.has(model.id));
	}

	/**
	 * Get all models (including disabled status) for organization settings page
	 */
	public async getAllModelsWithStatus(orgId: number) {
		// Get all models (global + custom for this org)
		const allModels = await this.prisma.languageModel.findMany({
			where: {
				OR: [
					{ apiKeyId: null }, // Global models
					{ apiKey: { organizationId: orgId } }, // Custom models for this org
				],
			},
			orderBy: [{ vendor: "asc" }, { name: "asc" }],
		});

		// Get disabled models for this organization
		const disabledModels = await this.prisma.organizationDisabledModel.findMany({
			where: { organizationId: orgId },
			select: { modelId: true },
		});

		const disabledIds = new Set(disabledModels.map((d) => d.modelId));

		// Add enabled/disabled status to each model
		return allModels.map((model) => ({
			...model,
			enabled: !disabledIds.has(model.id),
		}));
	}

	/**
	 * Disable a model for an organization
	 */
	public async disableModel(orgId: number, modelId: number) {
		return await this.prisma.organizationDisabledModel.create({
			data: {
				organizationId: orgId,
				modelId,
			},
		});
	}

	/**
	 * Enable a model for an organization (remove from disabled list)
	 */
	public async enableModel(orgId: number, modelId: number) {
		return await this.prisma.organizationDisabledModel.delete({
			where: {
				organizationId_modelId: {
					organizationId: orgId,
					modelId,
				},
			},
		});
	}

	/**
	 * Whether a model may be used by an organization at all.
	 *
	 * This is an allow-list: the model must be global or reachable through one of the
	 * organization's own provider keys, and must not be disabled. `isModelDisabled`
	 * alone is a deny-list, so another organization's custom model — simply absent
	 * from this organization's disabled list — used to pass.
	 */
	public async isModelAvailableForOrg(orgId: number, modelId: number): Promise<boolean> {
		const model = await this.prisma.languageModel.findFirst({
			where: {
				id: modelId,
				OR: [{ apiKeyId: null }, { apiKey: { organizationId: orgId } }],
			},
			select: { id: true },
		});
		if (!model) {
			return false;
		}
		return !(await this.isModelDisabled(orgId, modelId));
	}

	/**
	 * Check if a model is disabled for an organization
	 */
	public async isModelDisabled(orgId: number, modelId: number): Promise<boolean> {
		const disabled = await this.prisma.organizationDisabledModel.findUnique({
			where: {
				organizationId_modelId: {
					organizationId: orgId,
					modelId,
				},
			},
		});

		return disabled !== null;
	}

	/**
	 * Get usage info for a model in an organization
	 * Returns counts of prompts and commits using this model
	 */
	public async getModelUsageInfo(orgId: number, modelId: number) {
		// Get all projects in the organization
		const projects = await this.prisma.project.findMany({
			where: { organizationId: orgId },
			select: { id: true },
		});

		const projectIds = projects.map((p) => p.id);

		// Count prompts using this model
		const promptCount = await this.prisma.prompt.count({
			where: {
				projectId: { in: projectIds },
				languageModelId: modelId,
			},
		});

		// Count prompt versions (commits) using this model
		const commitCount = await this.prisma.promptVersion.count({
			where: {
				branch: {
					prompt: {
						projectId: { in: projectIds },
					},
				},
				languageModelId: modelId,
			},
		});

		return {
			promptCount,
			commitCount,
		};
	}
}
