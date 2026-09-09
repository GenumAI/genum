import { describe, it, expect } from "vitest";
import { finishedTurnSteps, conversationNumberingProblem } from "./turn";
import type { ConversationMessage } from "@/ai/providers";

const askForWeather: ConversationMessage = {
	role: "assistant",
	content: "",
	toolCalls: [{ id: "call_1", name: "get_weather", args: { city: "Zagreb" } }],
};

describe("finishedTurnSteps", () => {
	it("writes nothing while the turn is still asking for tools", () => {
		// The whole point of the change: a turn is written once, whole. Mid-turn requests
		// wrote spans before, which is why a writer needed to know how many spans preceded it.
		const result = finishedTurnSteps(undefined, {
			answer: "",
			toolCalls: [{ id: "1", name: "weather", args: { city: "Paris" } }],
		});

		expect(result).toBeNull();
	});

	it("emits the whole turn when the model answers, in order", () => {
		// The turn's tool calls came in over several requests; the conversation carries them
		// all, and the answer arrives in `response`. All of it is one batch.
		const result = finishedTurnSteps(
			[
				{
					role: "assistant",
					content: "",
					toolCalls: [{ id: "1", name: "weather", args: { city: "Paris" } }],
				},
				{ role: "tool", toolCallId: "1", name: "weather", content: "12" },
			],
			{ answer: "12 in Paris" },
		);

		expect(result).toEqual({
			turnIndex: 0,
			steps: [
				{ kind: "tool_call", name: "weather", args: { city: "Paris" }, recordedResult: "12" },
				{ kind: "final", text: "12 in Paris" },
			],
		});
	});

	it("starts a later turn at the reply that opened it, and numbers the turn", () => {
		// Turn 2. Turn 1's spans are already written under their own trace, so they must not
		// appear again -- the batch starts after the reply that opened this turn.
		const result = finishedTurnSteps(
			[
				{
					role: "assistant",
					content: "",
					toolCalls: [{ id: "1", name: "weather", args: { city: "Paris" } }],
				},
				{ role: "tool", toolCallId: "1", name: "weather", content: "12" },
				{ role: "assistant", content: "12 in Paris" },
				{ role: "user", content: "and London?" },
				{
					role: "assistant",
					content: "",
					toolCalls: [{ id: "2", name: "weather", args: { city: "London" } }],
				},
				{ role: "tool", toolCallId: "2", name: "weather", content: "9" },
			],
			{ answer: "9 in London" },
		);

		expect(result).toEqual({
			turnIndex: 1,
			steps: [
				{ kind: "user", text: "and London?" },
				{ kind: "tool_call", name: "weather", args: { city: "London" }, recordedResult: "9" },
				{ kind: "final", text: "9 in London" },
			],
		});
	});

	it("emits a turn that answered without calling a tool", () => {
		const result = finishedTurnSteps(
			[
				{ role: "assistant", content: "hello" },
				{ role: "user", content: "what is the weather?" },
			],
			{ answer: "I need a tool for that" },
		);

		expect(result).toEqual({
			turnIndex: 1,
			steps: [
				{ kind: "user", text: "what is the weather?" },
				{ kind: "final", text: "I need a tool for that" },
			],
		});
	});

	it("emits every call from every assistant message of the turn, each matched to its own result", () => {
		// A turn whose calls span TWO assistant messages, one of which calls the SAME tool
		// twice with different arguments. This is the one fixture that catches three wrong
		// shortcuts at once: emitting only the last assistant message's calls (loses the
		// first message's call entirely), emitting only a message's first call (loses the
		// second `get_time` call), and keying `recordedResult` by tool name instead of call
		// id (crosses the two `get_time` results).
		const result = finishedTurnSteps(
			[
				{ role: "assistant", content: "turn 1 answer" },
				{ role: "user", content: "weather and time?" },
				{
					role: "assistant",
					content: "",
					toolCalls: [{ id: "call_1", name: "get_weather", args: { city: "Zagreb" } }],
				},
				{ role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" },
				{
					role: "assistant",
					content: "",
					toolCalls: [
						{ id: "call_2", name: "get_time", args: { tz: "UTC" } },
						{ id: "call_3", name: "get_time", args: { tz: "CET" } },
					],
				},
				{ role: "tool", toolCallId: "call_2", name: "get_time", content: "10:00" },
				{ role: "tool", toolCallId: "call_3", name: "get_time", content: "11:00" },
			],
			{ answer: "12C in Zagreb, 10:00 UTC / 11:00 CET" },
		);

		expect(result).toEqual({
			turnIndex: 1,
			steps: [
				{ kind: "user", text: "weather and time?" },
				{
					kind: "tool_call",
					name: "get_weather",
					args: { city: "Zagreb" },
					recordedResult: "12C",
				},
				{
					kind: "tool_call",
					name: "get_time",
					args: { tz: "UTC" },
					recordedResult: "10:00",
				},
				{
					kind: "tool_call",
					name: "get_time",
					args: { tz: "CET" },
					recordedResult: "11:00",
				},
				{ kind: "final", text: "12C in Zagreb, 10:00 UTC / 11:00 CET" },
			],
		});
	});
});

// The numbering above reads the conversation's SHAPE, and nothing else checks it:
// `PromptRunSchema` validates each message on its own, so a conversation no numbering can
// be correct for parses fine and writes corrupt rows into an append-only table. These pin
// the rejection.
describe("conversationNumberingProblem", () => {
	it("passes a first request, which carries no conversation at all", () => {
		expect(conversationNumberingProblem(undefined)).toBeNull();
	});

	it("passes a tool continuation", () => {
		expect(
			conversationNumberingProblem([
				askForWeather,
				{ role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" },
			]),
		).toBeNull();
	});

	it("passes a user continuation that carries the answer it replies to", () => {
		expect(
			conversationNumberingProblem([
				askForWeather,
				{ role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" },
				{ role: "assistant", content: "It is 12 degrees." },
				{ role: "user", content: "and in London?" },
			]),
		).toBeNull();
	});

	it("passes a plain-answer continuation: turn 1 never called a tool", () => {
		expect(
			conversationNumberingProblem([
				{ role: "assistant", content: "hi" },
				{ role: "user", content: "now the real question" },
			]),
		).toBeNull();
	});

	it("rejects a reply that arrives without the answer it replies to", () => {
		// Exactly what the pre-fix web bundle sent. `finishedTurnSteps` would count the
		// reply as closing a turn, losing the tool call before it and attributing the
		// reply to a turn that never actually answered.
		const problem = conversationNumberingProblem([
			askForWeather,
			{ role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" },
			{ role: "user", content: "and in London?" },
		]);
		expect(problem).toContain("message 3");
		expect(problem).toContain("numbered");
	});

	it("rejects a reply that follows an assistant turn which only asked for a tool", () => {
		expect(
			conversationNumberingProblem([askForWeather, { role: "user", content: "next" }]),
		).not.toBeNull();
	});

	it("rejects a mid-conversation reply that lost its answer, not only a trailing one", () => {
		// A reply in the middle mis-numbers every span after it just as thoroughly.
		expect(
			conversationNumberingProblem([
				askForWeather,
				{ role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" },
				{ role: "user", content: "and in London?" },
				{ role: "assistant", content: "14 in London" },
			]),
		).not.toBeNull();
	});
});
