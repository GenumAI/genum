import { describe, it, expect } from "vitest";
import { inputMapper } from "./utils";
import type { ProviderRequest } from "..";

function withUserReply(): ProviderRequest["messages"] {
	return [
		{ role: "assistant", content: "one", toolCalls: [] },
		{ role: "user", content: "and in London?" },
	];
}

function request(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
	return {
		apikey: "key",
		instruction: "You are helpful",
		question: "Hello",
		model: "gpt-5",
		parameters: {},
		promptPrice: 0.44,
		completionPrice: 1.32,
		...overrides,
	};
}

describe("inputMapper with no conversation", () => {
	it("returns the bare question string when there are no messages and no files", () => {
		expect(inputMapper(request())).toBe("Hello");
	});

	it("returns the unchanged one-element array when files are present but no messages", () => {
		const files = [
			{
				id: "1",
				buffer: Buffer.from(""),
				contentType: "image/png",
				fileName: "a.png",
			},
		];

		expect(inputMapper(request({ files }))).toEqual([
			{
				role: "user",
				content: [
					{ type: "input_text", text: "Hello" },
					{
						type: "input_image",
						image_url: "data:image/png;base64,",
						detail: "auto",
					},
				],
			},
		]);
	});
});

describe("inputMapper with a conversation", () => {
	it("maps a user reply to a user message item, not an assistant one", () => {
		const result = inputMapper(request({ messages: withUserReply() }));

		expect(result).toContainEqual({ role: "user", content: "and in London?" });
	});

	it("keeps the assistant's own answer in the conversation", () => {
		// `replayTrajectory` puts the model's answer back before the reply that answers it,
		// exactly as the playground client does when recording. Dropped, the replayed model
		// answers a follow-up with no memory of what it just said -- and turn 2's pinned
		// final was produced in a context the replay cannot reproduce, so a correct agent
		// is written NOK on every run. Anthropic, Gemini and DeepSeek all keep this text.
		const result = inputMapper(request({ messages: withUserReply() }));

		expect(result).toContainEqual({ role: "assistant", content: "one" });
	});

	it("puts the assistant's answer BEFORE the reply that answers it", () => {
		const result = inputMapper(request({ messages: withUserReply() })) as {
			role?: string;
			content?: string;
		}[];

		const answer = result.findIndex((item) => item.role === "assistant");
		const reply = result.findIndex((item) => item.content === "and in London?");
		expect(answer).toBeGreaterThanOrEqual(0);
		expect(answer).toBeLessThan(reply);
	});

	it("keeps text that accompanies a tool call, and puts it before the call", () => {
		const result = inputMapper(
			request({
				messages: [
					{
						role: "assistant",
						content: "Let me look that up.",
						toolCalls: [{ id: "call_1", name: "weather", args: { city: "Kyiv" } }],
					},
					{ role: "tool", toolCallId: "call_1", name: "weather", content: '{"c":21}' },
				],
			}),
		) as { role?: string; type?: string }[];

		const text = result.findIndex((item) => item.role === "assistant");
		const call = result.findIndex((item) => item.type === "function_call");
		expect(text).toBeGreaterThanOrEqual(0);
		expect(text).toBeLessThan(call);
	});

	it("emits no assistant item for an answer with no text", () => {
		// An empty string is not a message the API accepts, and a turn that produced only
		// a tool call has nothing to say yet.
		const result = inputMapper(
			request({
				messages: [
					{
						role: "assistant",
						content: "",
						toolCalls: [{ id: "call_1", name: "weather", args: {} }],
					},
					{ role: "tool", toolCallId: "call_1", name: "weather", content: "{}" },
				],
			}),
		) as { role?: string }[];

		expect(result.some((item) => item.role === "assistant")).toBe(false);
	});
});
