import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiVendor } from "@/prisma";
import type { Database } from "@/database/db";
import { migrateSystemPromptModels, type SystemPromptModel } from "./models";

const MODELS = [
	{ id: 1, name: "o4-mini", vendor: AiVendor.OPENAI, apiKeyId: null, parametersConfig: null },
	{ id: 2, name: "gpt-5.6-luna", vendor: AiVendor.OPENAI, apiKeyId: null, parametersConfig: null },
	{ id: 3, name: "gpt-5", vendor: AiVendor.OPENAI, apiKeyId: null, parametersConfig: null },
	{ id: 4, name: "gpt-5.6-terra", vendor: AiVendor.OPENAI, apiKeyId: null, parametersConfig: null },
	{ id: 5, name: "gpt-5.5", vendor: AiVendor.OPENAI, apiKeyId: null, parametersConfig: null },
];

function makeDb(commits: Record<string, { languageModelId: number; config?: object } | null>) {
	const prompts = Object.keys(commits).map((name, i) => ({ id: 100 + i, name }));
	return {
		prompts: {
			getModels: vi.fn(async () => MODELS),
			getSystemPromptByName: vi.fn(async (name: string) =>
				prompts.find((p) => p.name === name) ?? null,
			),
			getProductiveCommit: vi.fn(async (id: number) => {
				const name = prompts.find((p) => p.id === id)?.name ?? "";
				const commit = commits[name];
				return commit
					? {
							value: `committed text of ${name}`,
							languageModelId: commit.languageModelId,
							languageModelConfig: commit.config ?? {},
						}
					: null;
			}),
			updatePromptById: vi.fn(),
			updatePromptLLMConfig: vi.fn(),
			commit: vi.fn(),
			changePromptCommitStatus: vi.fn(),
		},
	};
}

const AUDITOR: SystemPromptModel = {
	name: "PROMPT_AUDITOR",
	languageModelName: "gpt-5.6-luna",
	languageModelConfig: { tools: [], response_format: "text", reasoning_effort: "medium" },
};

const EDITOR: SystemPromptModel = {
	name: "JSON_SCHEMA_EDITOR",
	languageModelName: "gpt-5.6-terra",
	languageModelConfig: {
		tools: [],
		verbosity: "low",
		response_format: "text",
		reasoning_effort: "low",
	},
};

describe("migrateSystemPromptModels", () => {
	beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));

	it("moves a system prompt off a deprecated model with a new commit", async () => {
		const db = makeDb({ PROMPT_AUDITOR: { languageModelId: 1 } });

		await migrateSystemPromptModels(db as unknown as Database, 7, [AUDITOR]);

		// The commit must carry the served text, not whatever draft the row holds.
		expect(db.prompts.updatePromptById).toHaveBeenCalledWith(100, {
			value: "committed text of PROMPT_AUDITOR",
		});
		expect(db.prompts.updatePromptLLMConfig).toHaveBeenCalledWith(100, {
			languageModelId: 2,
			languageModelConfig: expect.objectContaining({ reasoning_effort: "medium" }),
		});
		expect(db.prompts.commit).toHaveBeenCalledWith(
			100,
			"Move to gpt-5.6-luna: o4-mini shuts down on 2026-10-23",
			7,
		);
		expect(db.prompts.changePromptCommitStatus).toHaveBeenCalledWith(100, true);
	});

	// GPT-5.6 has no "minimal"; the seed's level replaces the committed one.
	it("takes the seed's settings over the committed ones the new model would reject", async () => {
		const db = makeDb({
			JSON_SCHEMA_EDITOR: {
				languageModelId: 3,
				config: { reasoning_effort: "minimal", verbosity: "high" },
			},
		});

		await migrateSystemPromptModels(db as unknown as Database, 7, [EDITOR]);

		const config = db.prompts.updatePromptLLMConfig.mock.calls[0][1].languageModelConfig;
		expect(config).toMatchObject({ reasoning_effort: "low", verbosity: "low" });
	});

	// A system prompt someone moved by hand to a model that is still current stays where it is.
	it("leaves a system prompt on a current model alone, even one the seed does not name", async () => {
		const db = makeDb({ PROMPT_AUDITOR: { languageModelId: 5 } });

		await migrateSystemPromptModels(db as unknown as Database, 7, [AUDITOR]);

		expect(db.prompts.commit).not.toHaveBeenCalled();
	});

	it("skips a system prompt that does not exist yet or has no commit", async () => {
		const db = makeDb({ PROMPT_AUDITOR: null });

		await migrateSystemPromptModels(db as unknown as Database, 7, [AUDITOR, EDITOR]);

		expect(db.prompts.commit).not.toHaveBeenCalled();
	});

	it("warns, and moves nothing, when the seed still names the withdrawn model", async () => {
		const db = makeDb({ PROMPT_AUDITOR: { languageModelId: 1 } });

		await migrateSystemPromptModels(db as unknown as Database, 7, [
			{ ...AUDITOR, languageModelName: "o4-mini" },
		]);

		expect(db.prompts.commit).not.toHaveBeenCalled();
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("PROMPT_AUDITOR"));
	});
});
