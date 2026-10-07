import { getModelLifecycle } from "@/ai/models/lifecycle";
import { ModelConfigService } from "@/ai/models/modelConfigService";
import type { ModelConfigParameters } from "@/ai/models/types";
import type { Database } from "@/database/db";

/** The part of a seeded system prompt that says which model it runs on. */
export type SystemPromptModel = {
	name: string;
	languageModelName: string;
	languageModelConfig: ModelConfigParameters;
};

/**
 * Moves every system prompt whose served model its vendor is withdrawing onto the model the seed
 * names for it, with a new commit by the system user.
 *
 * The seed only ever creates system prompts, so a changed `languageModelName` would otherwise
 * reach new installs alone, and every existing one would keep calling the old model until the
 * vendor shut it down. Nobody can do it by hand: the system organization's only member is the
 * system user.
 *
 * A system prompt on a model that is still current is left alone, even if the seed names another:
 * whoever moved it chose that. The settings are the committed ones overlaid with the seed's, then
 * sanitized for the new model, so a level the new model rejects (GPT-5's "minimal") gives way to
 * the seed's. The prompt's text is reset to the committed one first, so the new commit changes the
 * model and nothing else.
 */
export async function migrateSystemPromptModels(
	database: Database,
	systemUserId: number,
	seeds: readonly SystemPromptModel[],
): Promise<void> {
	const models = await database.prompts.getModels();
	const modelConfigService = new ModelConfigService();
	let moved = 0;

	for (const seed of seeds) {
		const prompt = await database.prompts.getSystemPromptByName(seed.name);
		if (!prompt) continue;
		const commit = await database.prompts.getProductiveCommit(prompt.id);
		if (!commit) continue;

		const current = models.find((m) => m.id === commit.languageModelId);
		const lifecycle = current && getModelLifecycle(current);
		if (!current || !lifecycle) continue;

		const target = models.find((m) => m.name === seed.languageModelName && m.apiKeyId === null);
		if (!target || target.id === current.id) {
			console.warn(
				`System prompt ${seed.name} runs on ${current.name}, which its vendor is withdrawing, ` +
					`and the seed names no other model for it.`,
			);
			continue;
		}

		const languageModelConfig = modelConfigService.validateAndSanitizeConfig(
			target.name,
			target.vendor,
			{
				...(commit.languageModelConfig as ModelConfigParameters),
				...seed.languageModelConfig,
			},
			target.parametersConfig as Record<string, unknown> | null,
		);
		const reason =
			lifecycle.status === "retired"
				? `was shut down on ${lifecycle.retiredOn}`
				: `shuts down on ${lifecycle.retiresOn}`;

		await database.prompts.updatePromptById(prompt.id, { value: commit.value });
		await database.prompts.updatePromptLLMConfig(prompt.id, {
			languageModelId: target.id,
			languageModelConfig,
		});
		await database.prompts.commit(
			prompt.id,
			`Move to ${target.name}: ${current.name} ${reason}`,
			systemUserId,
		);
		await database.prompts.changePromptCommitStatus(prompt.id, true);
		console.log(`System prompt ${seed.name} moved from ${current.name} to ${target.name}`);
		moved++;
	}

	if (moved > 0) {
		console.log(`${moved} system prompts moved off withdrawn models`);
	}
}
