import { ModelConfigService } from "@/ai/models/modelConfigService";
import type { ModelConfigParameters } from "@/ai/models/types";
import type { Database } from "@/database/db";
import type { NewPromptModelOverride } from "@/database/repositories/PromptsRepository";
import type { AiVendor, Prompt } from "@/prisma";
import { commitHash } from "@/utils/hash";

type ProductivePrompt = {
	id: number;
	value: string;
	languageModelConfig: unknown;
	languageModelId: number;
};

export type ResolvePromptModelOverrideResult =
	| { ok: true; override: NewPromptModelOverride | null }
	| { ok: false; error: string };

export class PromptService {
	private readonly modelConfigService: ModelConfigService;

	constructor(private readonly db: Database) {
		this.modelConfigService = new ModelConfigService();
	}

	public async getModelsForOrganization(orgId: number) {
		// Use getAvailableModels to filter out disabled models
		return await this.db.organization.getAvailableModels(orgId);
	}

	/**
	 * Resolves the public prompt-creation API's optional `languageModelName` /
	 * `languageModelConfig` into a concrete { languageModelId, languageModelConfig }
	 * override for PromptsRepository.newProjectPrompt.
	 *
	 * - Neither given: returns `override: null` — caller falls back to the
	 *   historical default-model behavior untouched.
	 * - `languageModelName` given: resolved against this org's available
	 *   (enabled, global + custom) models; unknown name is a caller error.
	 * - `languageModelConfig` given: sanitized via modelConfigService against
	 *   the resolved model, or the instance default model if no name was given.
	 * - `languageModelName` given without a config: the resolved model's own
	 *   defaults are used (mirrors changePromptModel's model-switch behavior).
	 */
	public async resolvePromptModelOverride(
		orgId: number,
		input: { languageModelName?: string; languageModelConfig?: ModelConfigParameters },
	): Promise<ResolvePromptModelOverrideResult> {
		const { languageModelName, languageModelConfig } = input;

		if (!languageModelName && !languageModelConfig) {
			return { ok: true, override: null };
		}

		let model: { id: number; name: string; vendor: AiVendor; parametersConfig: unknown };

		if (languageModelName) {
			const availableModels = await this.getModelsForOrganization(orgId);
			const match = availableModels.find((candidate) => candidate.name === languageModelName);
			if (!match) {
				return { ok: false, error: `Unknown model: ${languageModelName}` };
			}
			model = match;
		} else {
			model = await this.db.prompts.getDefaultLanguageModelRow();
		}

		const parametersConfig = model.parametersConfig as
			| Record<string, unknown>
			| null
			| undefined;

		const resolvedConfig = languageModelConfig
			? this.modelConfigService.validateAndSanitizeConfig(
					model.name,
					model.vendor,
					languageModelConfig,
					parametersConfig,
				)
			: this.modelConfigService.getDefaultValuesForModel(
					model.name,
					model.vendor,
					parametersConfig,
				);

		return {
			ok: true,
			override: { languageModelId: model.id, languageModelConfig: resolvedConfig },
		};
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
