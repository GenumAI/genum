import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("openai", () => ({
	default: class {
		responses = { create };
	},
}));

import { generateOpenAI } from "./generate";
import type { ProviderRequest } from "..";

function request(): ProviderRequest {
	return {
		apikey: "key",
		instruction: "You are helpful",
		question: "weather in Berlin?",
		model: "gpt-5",
		parameters: {},
		promptPrice: 1,
		completionPrice: 1,
	};
}

function functionCall(name: string, args: string, callId: string) {
	return { type: "function_call", name, arguments: args, call_id: callId };
}

describe("generateOpenAI tool call normalization", () => {
	beforeEach(() => create.mockReset());

	it("normalizes every function call, not just the first", async () => {
		create.mockResolvedValue({
			output: [
				functionCall("get_weather", '{"city":"Berlin"}', "call_1"),
				functionCall("get_time", '{"tz":"CET"}', "call_2"),
			],
			usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
		});

		const result = await generateOpenAI(request());

		expect(result.toolCalls).toEqual([
			{ id: "call_1", name: "get_weather", args: { city: "Berlin" } },
			{ id: "call_2", name: "get_time", args: { tz: "CET" } },
		]);
	});

	it("leaves toolCalls undefined for a plain text answer", async () => {
		create.mockResolvedValue({
			output: [{ type: "message", content: [{ type: "output_text", text: "It is 12°" }] }],
			usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
		});

		const result = await generateOpenAI(request());

		expect(result.toolCalls).toBeUndefined();
		expect(result.answer).toBe("It is 12°");
	});
});

describe("generateOpenAI usage normalization", () => {
	beforeEach(() => create.mockReset());

	it("reports cached input inside prompt and reasoning inside completion", async () => {
		create.mockResolvedValue({
			output: [functionCall("get_weather", '{"city":"Berlin"}', "call_1")],
			usage: {
				input_tokens: 1000,
				input_tokens_details: { cached_tokens: 800 },
				output_tokens: 300,
				output_tokens_details: { reasoning_tokens: 250 },
				total_tokens: 1300,
			},
		});

		const result = await generateOpenAI(request());

		expect(result.tokens).toEqual({
			prompt: 1000,
			completion: 300,
			total: 1300,
			cacheRead: 800,
			cacheWrite: 0,
			reasoning: 250,
		});
	});

	it("reports zeros, not NaN, when a compatible provider sends no usage", async () => {
		create.mockResolvedValue({
			output: [functionCall("get_weather", '{"city":"Berlin"}', "call_1")],
		});

		const result = await generateOpenAI(request());

		expect(result.tokens).toEqual({
			prompt: 0,
			completion: 0,
			total: 0,
			cacheRead: 0,
			cacheWrite: 0,
			reasoning: 0,
		});
	});
});
