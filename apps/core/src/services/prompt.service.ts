import { ModelConfigService } from "@/ai/models/modelConfigService";
import type { ModelConfigParameters } from "@/ai/models/types";
import type { Database } from "@/database/db";
import type { AiVendor, Prompt } from "@/prisma";
import { commitHash } from "@/utils/hash";

type ProductivePrompt = {
	id: number;
	value: string;
	languageModelConfig: unknown;
	languageModelId: number;
};

export class PromptService {
	private readonly modelConfigService: ModelConfigService;

	constructor(private readonly db: Database) {
		this.modelConfigService = new ModelConfigService();
	}

	public async getModelsForOrganization(orgId: number) {
		return await this.db.prompts.getModelsByOrganization(orgId);
	}

	public async updateCommitedStatus(prompt: Prompt): Promise<Prompt> {
		const generations = await this.db.prompts.getPromptCommitCount(prompt.id);
		const hash = commitHash(prompt, generations);

		const lastCommit = await this.db.prompts.getProductiveCommit(prompt.id);
		if (!lastCommit) {
			return prompt;
		}

		if (lastCommit.commitHash === hash) {
			if (!prompt.commited) {
				return await this.db.prompts.changePromptCommitStatus(prompt.id, true);
			}
		} else if (prompt.commited) {
			return await this.db.prompts.changePromptCommitStatus(prompt.id, false);
		}

		return prompt;
	}

	public async reindexPromptsForCustomModel(options: {
		orgId: number;
		modelId: number;
		modelName: string;
		vendor: AiVendor;
		parametersConfig?: Record<string, unknown> | null;
	}) {
		const prompts = await this.db.prompts.getPromptsByModelId(options.orgId, options.modelId);
		if (prompts.length === 0) {
			return { updated: 0, skipped: 0 };
		}

		const parametersConfig = options.parametersConfig ?? null;
		const hasSchema = Boolean(parametersConfig && Object.keys(parametersConfig).length > 0);
		const defaultConfig = this.modelConfigService.getDefaultValuesForModel(
			options.modelName,
			options.vendor,
			parametersConfig,
		);

		let updated = 0;
		let skipped = 0;

		for (const prompt of prompts) {
			const currentConfig =
				prompt.languageModelConfig &&
				typeof prompt.languageModelConfig === "object" &&
				!Array.isArray(prompt.languageModelConfig)
					? (prompt.languageModelConfig as Record<string, unknown>)
					: {};

			const nextConfig = hasSchema
				? this.modelConfigService.validateAndSanitizeConfig(
						options.modelName,
						options.vendor,
						currentConfig as ModelConfigParameters,
						parametersConfig,
					)
				: defaultConfig;

			if (JSON.stringify(currentConfig) === JSON.stringify(nextConfig)) {
				skipped += 1;
				continue;
			}

			const updatedPrompt = await this.db.prompts.updatePromptLLMConfig(prompt.id, {
				languageModelConfig: nextConfig,
			});
			await this.updateCommitedStatus(updatedPrompt);
			updated += 1;
		}

		return { updated, skipped };
	}

	/**
	 * Returns the prompt with the latest productive commit applied.
	 * If requireCommit is true and no productive commit exists, returns null.
	 */
	public async getPromptWithProductiveCommit<T extends ProductivePrompt>(
		prompt: T,
		options: { requireCommit?: boolean } = {},
	): Promise<T | null> {
		const productiveCommit = await this.db.prompts.getProductiveCommit(prompt.id);

		if (!productiveCommit) {
			return options.requireCommit ? null : prompt;
		}

		return {
			...prompt,
			value: productiveCommit.value,
			languageModelConfig: productiveCommit.languageModelConfig,
			languageModelId: productiveCommit.languageModelId,
		};
	}
}
