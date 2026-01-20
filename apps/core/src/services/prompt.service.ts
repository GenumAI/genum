import type { Database } from "@/database/db";
import type { Prompt } from "@/prisma";
import { commitHash } from "@/utils/hash";

type ProductivePrompt = {
	id: number;
	value: string;
	languageModelConfig: unknown;
	languageModelId: number;
};

export class PromptService {
	constructor(private readonly db: Database) {}

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
