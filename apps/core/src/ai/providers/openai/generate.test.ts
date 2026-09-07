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
