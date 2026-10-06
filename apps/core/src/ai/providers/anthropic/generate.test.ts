import { describe, it, expect, vi, beforeEach } from "vitest";

// `create` stands in for the final message of a streamed request. The adapter must stream:
// without a stream the SDK refuses, before any network call, a max_tokens above ~21K, and every
// registry model defaults max_tokens to its full output limit.
// `streamEvents` are emitted to `streamEvent` listeners before the final message resolves, as
// the SDK's MessageStream does.
const create = vi.fn();
let streamEvents: unknown[] = [];
vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = {
			stream: (body: unknown) => {
				const listeners: ((event: unknown) => void)[] = [];
				const stream = {
					on(name: string, listener: (event: unknown) => void) {
						if (name === "streamEvent") listeners.push(listener);
						return stream;
					},
					async finalMessage() {
						for (const event of streamEvents) for (const l of listeners) l(event);
						return create(body);
					},
				};
				return stream;
			},
		};
	},
}));

import { generateAnthropic } from "./generate";
import type { ProviderRequest } from "..";

function request(): ProviderRequest {
	return {
		apikey: "key",
		instruction: "You are helpful",
		question: "weather in Berlin?",
		model: "claude-sonnet-5",
		parameters: { max_tokens: 100 },
	};
}

describe("generateAnthropic tool call normalization", () => {
	beforeEach(() => create.mockReset());

	it("normalizes every tool_use block", async () => {
		create.mockResolvedValue({
			content: [
				{ type: "tool_use", id: "tu_1", name: "get_weather", input: { city: "Berlin" } },
				{ type: "tool_use", id: "tu_2", name: "get_time", input: { tz: "CET" } },
			],
			usage: { input_tokens: 1, output_tokens: 2 },
		});

		const result = await generateAnthropic(request());

		expect(result.toolCalls).toEqual([
			{ id: "tu_1", name: "get_weather", args: { city: "Berlin" } },
			{ id: "tu_2", name: "get_time", args: { tz: "CET" } },
		]);
	});

	it("leaves toolCalls undefined for a text answer", async () => {
		create.mockResolvedValue({
			content: [{ type: "text", text: "It is 12°" }],
			usage: { input_tokens: 1, output_tokens: 2 },
		});

		const result = await generateAnthropic(request());

		expect(result.toolCalls).toBeUndefined();
		expect(result.answer).toBe("It is 12°");
	});
});

describe("generateAnthropic usage normalization", () => {
	beforeEach(() => create.mockReset());

	it("adds the cache tokens Anthropic reports beside input_tokens into prompt", async () => {
		create.mockResolvedValue({
			content: [{ type: "text", text: "It is 12°" }],
			usage: {
				input_tokens: 100,
				cache_read_input_tokens: 800,
				cache_creation_input_tokens: 50,
				output_tokens: 300,
			},
		});

		const result = await generateAnthropic(request());

		expect(result.tokens).toEqual({
			prompt: 950,
			completion: 300,
			total: 1250,
			cacheRead: 800,
			cacheWrite: 50,
			reasoning: 0,
		});
	});

	it("treats absent cache counts as zero", async () => {
		create.mockResolvedValue({
			content: [{ type: "text", text: "It is 12°" }],
			usage: { input_tokens: 1, output_tokens: 2 },
		});

		const result = await generateAnthropic(request());

		expect(result.tokens).toEqual({
			prompt: 1,
			completion: 2,
			total: 3,
			cacheRead: 0,
			cacheWrite: 0,
			reasoning: 0,
		});
	});
});

describe("generateAnthropic sampling parameters", () => {
	beforeEach(() => {
		create.mockReset();
		create.mockResolvedValue({
			content: [{ type: "text", text: "ok" }],
			usage: { input_tokens: 1, output_tokens: 1 },
		});
	});

	it("sends temperature to a model that declares it", async () => {
		await generateAnthropic({
			...request(),
			model: "claude-sonnet-4-6",
			parameters: { max_tokens: 100, temperature: 0.5 },
		});

		expect(create.mock.calls[0][0].temperature).toBe(0.5);
	});

	// Claude 4.7 and later answer 400 to any non-default temperature. A prompt saved before the
	// registry dropped the parameter still carries one in its stored config.
	it("drops a stored temperature for a model that does not accept one", async () => {
		await generateAnthropic({
			...request(),
			model: "claude-opus-4-7",
			parameters: { max_tokens: 100, temperature: 0.5 },
		});

		expect(create.mock.calls[0][0].temperature).toBeUndefined();
	});
});

describe("generateAnthropic adaptive thinking", () => {
	beforeEach(() => {
		create.mockReset();
		streamEvents = [];
		create.mockResolvedValue({
			content: [{ type: "text", text: "ok" }],
			usage: { input_tokens: 1, output_tokens: 1 },
		});
	});

	it("sends the selected effort and turns adaptive thinking on", async () => {
		await generateAnthropic({
			...request(),
			model: "claude-sonnet-5-5",
			parameters: { max_tokens: 100, reasoning_effort: "low" },
		});

		const body = create.mock.calls[0][0];
		expect(body.output_config).toEqual({ effort: "low" });
		expect(body.thinking).toEqual({ type: "adaptive" });
	});

	// Opus 4.8 keeps thinking off unless asked; the 5.x models think by default. Asking on every
	// model that offers effort makes the setting mean the same thing everywhere.
	it("leaves effort to the model's default when none is selected", async () => {
		await generateAnthropic({
			...request(),
			model: "claude-opus-4-8",
			parameters: { max_tokens: 100 },
		});

		const body = create.mock.calls[0][0];
		expect(body.output_config).toBeUndefined();
		expect(body.thinking).toEqual({ type: "adaptive" });
	});

	it("sends neither to a model that offers no effort", async () => {
		await generateAnthropic({
			...request(),
			model: "claude-opus-4-7",
			parameters: { max_tokens: 100, reasoning_effort: "high" },
		});

		const body = create.mock.calls[0][0];
		expect(body.output_config).toBeUndefined();
		expect(body.thinking).toBeUndefined();
	});

	it("answers from the text that follows the thinking blocks", async () => {
		create.mockResolvedValue({
			content: [
				{ type: "thinking", thinking: "", signature: "sig" },
				{ type: "redacted_thinking", data: "x" },
				{ type: "text", text: "It is 12°" },
			],
			usage: { input_tokens: 1, output_tokens: 2 },
		});

		const result = await generateAnthropic({ ...request(), model: "claude-opus-5-5" });

		expect(result.answer).toBe("It is 12°");
	});

	it("still fails when the response carries nothing but thinking", async () => {
		create.mockResolvedValue({
			content: [{ type: "thinking", thinking: "", signature: "sig" }],
			usage: { input_tokens: 1, output_tokens: 2 },
		});

		await expect(generateAnthropic({ ...request(), model: "claude-opus-5-5" })).rejects.toThrow(
			"No answer from Anthropic",
		);
	});

	// The SDK's stream accumulator drops output_tokens_details; it only reaches the
	// message_delta event. thinking_tokens is a part of output_tokens, not an addition.
	it("reports thinking tokens as reasoning inside completion", async () => {
		streamEvents = [
			{
				type: "message_delta",
				usage: { output_tokens: 300, output_tokens_details: { thinking_tokens: 250 } },
			},
		];
		create.mockResolvedValue({
			content: [{ type: "text", text: "ok" }],
			usage: { input_tokens: 10, output_tokens: 300 },
		});

		const result = await generateAnthropic({ ...request(), model: "claude-opus-5-5" });

		expect(result.tokens).toMatchObject({ completion: 300, reasoning: 250, total: 310 });
	});
});
