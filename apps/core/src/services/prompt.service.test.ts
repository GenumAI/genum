import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromptService, type ProductivePrompt } from "./prompt.service";
import type { Database } from "@/database/db";
import { AiVendor } from "@/prisma";

function makeMockDb() {
	return {
		organization: {
			getAvailableModels: vi.fn(),
		},
		prompts: {
			getDefaultLanguageModelRow: vi.fn(),
		},
	};
}

const GPT_4O = { id: 5, name: "gpt-4o", vendor: AiVendor.OPENAI, parametersConfig: null };

describe("PromptService.resolvePromptModelOverride", () => {
	let mockDb: ReturnType<typeof makeMockDb>;
	let service: PromptService;

	beforeEach(() => {
		mockDb = makeMockDb();
		service = new PromptService(mockDb as unknown as Database);
	});

	it("returns override: null when neither field is given (today's exact default path)", async () => {
		const result = await service.resolvePromptModelOverride(1, {});

		expect(result).toEqual({ ok: true, override: null });
		expect(mockDb.organization.getAvailableModels).not.toHaveBeenCalled();
		expect(mockDb.prompts.getDefaultLanguageModelRow).not.toHaveBeenCalled();
	});

	it("returns a 400-shaped error for an unknown model name", async () => {
		mockDb.organization.getAvailableModels.mockResolvedValue([GPT_4O]);

		const result = await service.resolvePromptModelOverride(1, {
			languageModelName: "not-a-real-model",
		});

		expect(result).toEqual({ ok: false, error: "Unknown model: not-a-real-model" });
	});

	it("resolves by name (scoped to the org's available models) and sanitizes the given config against it", async () => {
		mockDb.organization.getAvailableModels.mockResolvedValue([GPT_4O]);

		const result = await service.resolvePromptModelOverride(1, {
			languageModelName: "gpt-4o",
			languageModelConfig: {
				response_format: "json_schema",
				json_schema: '{"name":"x"}',
				temperature: 99, // out of range [0,2] -> clamped to the model's default (1)
				max_tokens: 100,
			},
		});

		expect(mockDb.organization.getAvailableModels).toHaveBeenCalledWith(1);
		expect(result).toEqual({
			ok: true,
			override: {
				languageModelId: 5,
				languageModelConfig: {
					response_format: "json_schema",
					json_schema: '{"name":"x"}',
					temperature: 1,
					max_tokens: 100,
					tools: [],
				},
			},
		});
	});

	it("uses the resolved model's own defaults when only languageModelName is given", async () => {
		mockDb.organization.getAvailableModels.mockResolvedValue([GPT_4O]);

		const result = await service.resolvePromptModelOverride(1, {
			languageModelName: "gpt-4o",
		});

		expect(result).toEqual({
			ok: true,
			override: {
				languageModelId: 5,
				languageModelConfig: {
					temperature: 1,
					max_tokens: 16384,
					response_format: "text",
					tools: [],
				},
			},
		});
	});

	it("sanitizes a config-only request against the instance default model, without listing the org's models", async () => {
		mockDb.prompts.getDefaultLanguageModelRow.mockResolvedValue(GPT_4O);

		const result = await service.resolvePromptModelOverride(1, {
			languageModelConfig: { response_format: "json_object" },
		});

		expect(mockDb.organization.getAvailableModels).not.toHaveBeenCalled();
		expect(mockDb.prompts.getDefaultLanguageModelRow).toHaveBeenCalledOnce();
		expect(result).toEqual({
			ok: true,
			override: {
				languageModelId: 5,
				languageModelConfig: {
					response_format: "json_object",
					temperature: 1,
					max_tokens: 16384,
					tools: [],
				},
			},
		});
	});
});

const db = {
	prompts: { getProductiveCommit: vi.fn() },
} as never;

describe("getPromptWithProductiveCommit", () => {
	let service: PromptService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new PromptService(db);
	});

	it("takes the definitions from the same commit as the text", async () => {
		vi.mocked((db as never as { prompts: { getProductiveCommit: ReturnType<typeof vi.fn> } })
			.prompts.getProductiveCommit).mockResolvedValue({
			value: "committed text {{k}}",
			languageModelConfig: {},
			languageModelId: 2,
			placeholders: [{ key: "k", values: [{ name: "v", content: "c", isDefault: true }] }],
		} as never);

		const result = await service.getPromptWithProductiveCommit({
			id: 1,
			value: "live text",
			languageModelConfig: {},
			languageModelId: 1,
		} as unknown as ProductivePrompt);

		expect(result?.value).toBe("committed text {{k}}");
		expect(result?.placeholderDefinitions).toEqual([
			{ key: "k", values: [{ name: "v", content: "c", isDefault: true }] },
		]);
	});

	it("gives a pre-feature commit no definitions rather than the live ones", async () => {
		vi.mocked((db as never as { prompts: { getProductiveCommit: ReturnType<typeof vi.fn> } })
			.prompts.getProductiveCommit).mockResolvedValue({
			value: "old text",
			languageModelConfig: {},
			languageModelId: 2,
			placeholders: null,
		} as never);

		const result = await service.getPromptWithProductiveCommit({
			id: 1,
		} as unknown as ProductivePrompt);

		expect(result?.placeholderDefinitions).toEqual([]);
	});

	// AMENDMENT (task-5): with no productive commit and requireCommit unset, the
	// live prompt is returned untouched. Returning `placeholderDefinitions: []`
	// here would be WRONG: run.ts treats an empty array as "use these definitions"
	// (an empty array is truthy), so it would never fall through to the live
	// placeholder tables and every {{hole}} would silently render as itself on
	// real runs. Do not "fix" this by adding a `[]` default.
	it("gives a live (uncommitted) prompt no placeholderDefinitions field at all, so the runner falls through to live tables", async () => {
		vi.mocked((db as never as { prompts: { getProductiveCommit: ReturnType<typeof vi.fn> } })
			.prompts.getProductiveCommit).mockResolvedValue(null as never);

		const result = await service.getPromptWithProductiveCommit({
			id: 1,
			value: "live text",
			languageModelConfig: {},
			languageModelId: 1,
		} as unknown as ProductivePrompt);

		expect(result?.placeholderDefinitions).toBeUndefined();
	});
});
