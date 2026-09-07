import { describe, it, expect, vi, beforeEach } from "vitest";

const generateContent = vi.fn();
vi.mock("@google/genai", () => ({
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
