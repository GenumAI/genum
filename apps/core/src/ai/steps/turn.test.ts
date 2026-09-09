import { describe, it, expect } from "vitest";
import { completedTurnSteps } from "./turn";
import type { ConversationMessage } from "@/ai/providers";

const askForWeather: ConversationMessage = {
	role: "assistant",
	content: "",
	toolCalls: [{ id: "call_1", name: "get_weather", args: { city: "Zagreb" } }],
};

describe("completedTurnSteps", () => {
	it("writes nothing for the opening turn: its calls have no results yet", () => {
		const { steps, spanIndexOffset } = completedTurnSteps(undefined, {
			answer: "",
			toolCalls: [{ id: "call_1", name: "get_weather", args: { city: "Zagreb" } }],
		});

		expect(steps).toEqual([]);
		expect(spanIndexOffset).toBe(0);
	});

	it("completes the previous turn's calls with the results the request carried", () => {
		const { steps, spanIndexOffset } = completedTurnSteps(
			[askForWeather, { role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" }],
			{ answer: "It is 12 degrees.", toolCalls: [] },
		);

		expect(spanIndexOffset).toBe(0);
		expect(steps).toEqual([
			{
				kind: "tool_call",
				name: "get_weather",
				args: { city: "Zagreb" },
				recordedResult: "12C",
			},
			{ kind: "final", text: "It is 12 degrees." },
		]);
	});

	it("offsets a later turn past the spans earlier turns already wrote", () => {
		const askTwice: ConversationMessage = {
			role: "assistant",
			content: "",
			toolCalls: [
				{ id: "call_2", name: "get_time", args: {} },
				{ id: "call_3", name: "get_time", args: { tz: "UTC" } },
			],
		};

		const { steps, spanIndexOffset } = completedTurnSteps(
			[
				askForWeather,
				{ role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" },
				askTwice,
				{ role: "tool", toolCallId: "call_2", name: "get_time", content: "10:00" },
				{ role: "tool", toolCallId: "call_3", name: "get_time", content: "08:00" },
			],
			{ answer: "Done.", toolCalls: [] },
		);

		// The one call of the first turn already has span_index 0.
		expect(spanIndexOffset).toBe(1);
		expect(steps.map((step) => step.kind)).toEqual(["tool_call", "tool_call", "final"]);
		expect(steps[0]).toMatchObject({ name: "get_time", recordedResult: "10:00" });
		// Two calls to the SAME tool stay two independent steps, matched by call id.
		expect(steps[1]).toMatchObject({
			name: "get_time",
			args: { tz: "UTC" },
			recordedResult: "08:00",
		});
	});

	it("omits the final step while the model is still asking for tools", () => {
		const { steps } = completedTurnSteps(
			[askForWeather, { role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" }],
			{ answer: "", toolCalls: [{ id: "call_2", name: "get_time", args: {} }] },
		);

		expect(steps.map((step) => step.kind)).toEqual(["tool_call"]);
	});

	it("emits the reply on the request the reply itself triggered", () => {
		// Otherwise the reply is recorded nowhere: the root `logs` row holds only the
		// session's first question, and `spansToSteps` would rebuild a session that jumps
		// from one answer to the next with nothing in between.
		const { steps } = completedTurnSteps(
			[
				{ role: "assistant", content: "", toolCalls: [{ id: "1", name: "t", args: {} }] },
				{ role: "tool", toolCallId: "1", name: "t", content: "{}" },
				{ role: "assistant", content: "21 in Paris" },
				{ role: "user", content: "and in London?" },
			],
			{ answer: "", toolCalls: [{ id: "2", name: "t", args: {} }] },
		);
		// Nothing else: the previous turn's call and final already have their spans, and
		// this turn's call is not answered until the next request.
		expect(steps).toEqual([{ kind: "user", text: "and in London?" }]);
	});

	it("does not emit the reply again on the next request of the same turn", () => {
		// The dangerous half. One request later the same reply is still in the conversation,
		// now sitting before the last assistant message. Emitting it again writes a second
		// `user` span for one reply and shifts every later index by one.
		const { steps } = completedTurnSteps(
			[
				{ role: "assistant", content: "", toolCalls: [{ id: "1", name: "t", args: {} }] },
				{ role: "tool", toolCallId: "1", name: "t", content: "{}" },
				{ role: "assistant", content: "21 in Paris" },
				{ role: "user", content: "and in London?" },
				{ role: "assistant", content: "", toolCalls: [{ id: "2", name: "t", args: {} }] },
				{ role: "tool", toolCallId: "2", name: "t", content: "{}" },
			],
			{ answer: "14 in London" },
		);
		expect(steps.some((step) => step.kind === "user")).toBe(false);
		expect(steps).toEqual([
			{ kind: "tool_call", name: "t", args: {}, recordedResult: "{}" },
			{ kind: "final", text: "14 in London" },
		]);
	});

	it("counts every span an earlier turn wrote, not only its tool calls", () => {
		// The offset addresses an append-only table. A turn that answered plainly wrote an
		// `llm` span and a reply wrote a `user` span; counting only tool calls hands the next
		// turn an index two rows behind, and the trace reads back in the wrong order.
		const { spanIndexOffset } = completedTurnSteps(
			[
				// turn 1: one call, then a final -> 2 spans
				{ role: "assistant", content: "", toolCalls: [{ id: "1", name: "t", args: {} }] },
				{ role: "tool", toolCallId: "1", name: "t", content: "{}" },
				{ role: "assistant", content: "21 in Paris" },
				// the reply -> 1 span
				{ role: "user", content: "and in London?" },
				// turn 2, the last: its calls are what THIS request answered
				{ role: "assistant", content: "", toolCalls: [{ id: "2", name: "t", args: {} }] },
				{ role: "tool", toolCallId: "2", name: "t", content: "{}" },
			],
			{ answer: "14 in London" },
		);
		expect(spanIndexOffset).toBe(3);
	});
});
