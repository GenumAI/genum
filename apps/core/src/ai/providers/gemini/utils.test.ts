import { describe, it, expect } from "vitest";
import { mapContentsToGeminiFormat } from "./utils";
import type { ProviderRequest } from "..";

function request(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
	return {
		apikey: "key",
		instruction: "You are helpful",
		question: "Hello",
		model: "gemini-2.5-flash",
		parameters: {},
		promptPrice: 0.44,
		completionPrice: 1.32,
		...overrides,
	};
}

describe("mapContentsToGeminiFormat with no conversation", () => {
	it("is unchanged when no messages and no files are passed", () => {
		expect(mapContentsToGeminiFormat(request())).toEqual("Hello");
	});

	it("is unchanged when files are present but no messages are passed", () => {
		const files = [
			{
				id: "1",
				buffer: Buffer.from(""),
				contentType: "image/png",
				fileName: "a.png",
			},
		];

		expect(mapContentsToGeminiFormat(request({ files }))).toEqual([
			{ text: "Hello" },
			{ inlineData: { mimeType: "image/png", data: "" } },
		]);
	});
});

// `PromptRunSchema` permits an assistant message with no tool calls (a plain assistant
// turn in a conversation). Mapping it to `parts: []` produces a payload Gemini rejects,
// so a valid request could only fail at the provider.
describe("mapContentsToGeminiFormat with a conversation", () => {
	it("carries an assistant message's text through when it has no tool calls", () => {
		const contents = mapContentsToGeminiFormat(
			request({
				messages: [{ role: "assistant", content: "Let me check." }],
			}),
		);

		expect(contents).toEqual([
			{ role: "user", parts: [{ text: "Hello" }] },
			{ role: "model", parts: [{ text: "Let me check." }] },
		]);
	});

	it("never emits an empty parts array, even for an empty assistant turn", () => {
		const contents = mapContentsToGeminiFormat(
			request({ messages: [{ role: "assistant", content: "" }] }),
		) as { role: string; parts: unknown[] }[];

		expect(contents[1].parts.length).toBeGreaterThan(0);
	});

	it("keeps the text alongside the tool calls it was emitted with", () => {
		const contents = mapContentsToGeminiFormat(
			request({
				messages: [
					{
						role: "assistant",
						content: "Checking the weather.",
						toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Berlin" } }],
					},
					{
						role: "tool",
						toolCallId: "c1",
						name: "get_weather",
						content: '{"temp":12}',
					},
				],
			}),
		);

		expect(contents).toEqual([
			{ role: "user", parts: [{ text: "Hello" }] },
			{
				role: "model",
				parts: [
					{ text: "Checking the weather." },
					{ functionCall: { name: "get_weather", args: { city: "Berlin" } } },
				],
			},
			{
				role: "user",
				parts: [
					{
						functionResponse: {
							name: "get_weather",
							response: { result: '{"temp":12}' },
						},
					},
				],
			},
		]);
	});
});
