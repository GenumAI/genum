import { db } from "@/database/db";
import type { SeedModelFields } from "@/ai/models/builder";
import { toLanguageModelData } from "@/ai/models/builder";
import { ALL_MODELS } from "@/ai/models/vendors";

export type LanguageModelData = SeedModelFields;

type DbModel = {
	displayName: string | null;
	promptPrice: number;
	completionPrice: number;
	contextTokensMax: number;
	completionTokensMax: number;
	description: string;
};

function isModelDifferent(existing: DbModel, incoming: LanguageModelData): boolean {
	return (
		existing.displayName !== (incoming.displayName ?? null) ||
		existing.promptPrice !== incoming.promptPrice ||
		existing.completionPrice !== incoming.completionPrice ||
		existing.contextTokensMax !== incoming.contextTokensMax ||
		existing.completionTokensMax !== incoming.completionTokensMax ||
		existing.description !== incoming.description
	);
}

/**
 * Sync language models from vendors registry.
 * Creates new models and updates existing ones if they differ.
 */
export async function syncModels(): Promise<void> {
	const models = ALL_MODELS.map(toLanguageModelData);
	const existingModels = await db.prompts.getModels();

	const toCreate: LanguageModelData[] = [];
	const toUpdate: LanguageModelData[] = [];

	for (const model of models) {
		const existing = existingModels.find(
			(e) => e.name === model.name && e.vendor === model.vendor,
		);

		if (!existing) {
			toCreate.push(model);
		} else if (isModelDifferent(existing, model)) {
			toUpdate.push(model);
		}
	}

	if (toCreate.length === 0 && toUpdate.length === 0) {
		console.log(`${existingModels.length} models checked. All up to date.`);
		return;
	}

	if (toCreate.length > 0) {
		console.log(`Creating ${toCreate.length} models...`);
		await Promise.all(toCreate.map((model) => db.prompts.createModel(model)));
	}

	if (toUpdate.length > 0) {
		console.log(`Updating ${toUpdate.length} models...`);
		await Promise.all(toUpdate.map((model) => db.prompts.updateModel(model)));
	}

	console.log(
		`Language models sync complete: ${toCreate.length} created, ${toUpdate.length} updated.`,
	);
}
