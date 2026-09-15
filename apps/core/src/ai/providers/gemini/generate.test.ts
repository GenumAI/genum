import { describe, it, expect, vi, beforeEach } from "vitest";

const generateContent = vi.fn();
// Partial, not a replacement: the SDK's `Type` and `ThinkingLevel` enums are real values
// read at module load by the schema converter and the config mapper, so a mock that omits
// them fails the whole suite on import rather than on any assertion.
vi.mock("@google/genai", async (importOriginal) => ({
	...(await importOriginal<typeof import("@google/genai")>()),
	GoogleGenAI: class {
		models = { generateContent };
	},
}));

import { generateGemini } from "./generate";
import type { ProviderRequest } from "..";

function request(): ProviderRequest {
	return {
		apikey: "key",
		instruction: "You are helpful",
		question: "weather in Berlin?",
		model: "gemini-3-pro",
		parameters: {},
		promptPrice: 1,
		completionPrice: 1,
	};
}

describe("generateGemini tool call normalization", () => {
	beforeEach(() => generateContent.mockReset());

	it("normalizes every functionCall part and synthesizes ids", async () => {
		generateContent.mockResolvedValue({
			candidates: [
				{
					content: {
						parts: [
							{ functionCall: { name: "get_weather", args: { city: "Berlin" } } },
							{ functionCall: { name: "get_time", args: { tz: "CET" } } },
						],
					},
				},
			],
			usageMetadata: {
				promptTokenCount: 1,
				candidatesTokenCount: 2,
				totalTokenCount: 3,
			},
		});

		const result = await generateGemini(request());

		expect(result.toolCalls).toEqual([
			{ id: "gemini-0", name: "get_weather", args: { city: "Berlin" } },
			{ id: "gemini-1", name: "get_time", args: { tz: "CET" } },
		]);
	});
});

describe("generateGemini usage normalization", () => {
	beforeEach(() => generateContent.mockReset());

	it("adds thoughts into completion and tool-use input into prompt", async () => {
		generateContent.mockResolvedValue({
			candidates: [{ content: { parts: [{ text: "It is 12°" }] } }],
			usageMetadata: {
				promptTokenCount: 1000,
				cachedContentTokenCount: 600,
				toolUsePromptTokenCount: 40,
				candidatesTokenCount: 200,
				thoughtsTokenCount: 500,
				totalTokenCount: 1740,
			},
		});

		const result = await generateGemini(request());

		expect(result.tokens).toEqual({
			prompt: 1040,
			completion: 700,
			total: 1740,
			cacheRead: 600,
			cacheWrite: 0,
			reasoning: 500,
		});
	});
});
