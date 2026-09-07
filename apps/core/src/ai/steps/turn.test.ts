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
});
