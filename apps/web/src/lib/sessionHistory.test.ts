import { describe, expect, it } from "vitest";

import { spansToSteps } from "./spansToSteps";
import type { SpanRow } from "@/types/spans";

function row(overrides: Partial<SpanRow>): SpanRow {
	return {
		trace_id: "turn-1",
		span_id: "span",
		parent_span_id: null,
		span_index: 0,
		span_type: "chat",
		orgId: 1,
		project_id: 2,
		prompt_id: 3,
		name: "",
		input: "",
		output: "",
		tool_args: "",
		tool_result: "",
		tool_error: null,
		vendor: "openai",
		model: "gpt-4o",
		tokens_in: 0,
		tokens_out: 0,
		cost: 0,
		duration_ms: 0,
		status: "OK",
		...overrides,
	};
}

// The message shapes of the current conventions, as an external app that runs its own agent
// loop sends them: context on the message being answered, none on the older ones.
const user = (content: string) => ({ role: "user", parts: [{ type: "text", content }] });
const assistant = (content: string) => ({
	role: "assistant",
	parts: [{ type: "text", content }],
});
const toolCall = (id: string, name: string, args: Record<string, unknown>) => ({
	role: "assistant",
	parts: [{ type: "tool_call", id, name, arguments: args }],
});
const toolResponse = (id: string, response: unknown) => ({
	role: "tool",
	parts: [{ type: "tool_call_response", id, response }],
});
const input = (...messages: unknown[]) => JSON.stringify(messages);

describe("spansToSteps: what the session's history adds", () => {
	it("keeps an exchange that happened before the first recorded turn", () => {
		// "hello" -> "Hi!" never arrived as a trace of its own, but every later model call
		// carries it. Dropped, the testcase opened with the follow-up alone and the replayed
		// model greeted a session that had already asked its question.
		const spans = [
			row({ span_type: "user", output: "<ctx>any meetings?" }),
			row({
				span_index: 1,
				input: input(user("hello"), assistant("Hi! How can I help?"), user("<ctx>any meetings?")),
			}),
			row({
				span_index: 2,
				span_type: "execute_tool",
				name: "execute_tool searchCalendar",
				tool_args: '{"mailbox":""}',
				tool_result: '{"error":"which mailbox?"}',
			}),
			row({ span_index: 3, output: "Which mailbox?" }),
			row({ trace_id: "turn-2", span_type: "user", output: "<ctx>the first one" }),
			row({
				trace_id: "turn-2",
				span_index: 1,
				input: input(
					user("hello"),
					assistant("Hi! How can I help?"),
					user("any meetings?"),
					toolCall("c1", "searchCalendar", { mailbox: "" }),
					toolResponse("c1", { error: "which mailbox?" }),
					assistant("Which mailbox?"),
					user("<ctx>the first one"),
				),
				output: "None today.",
			}),
		];

		const { steps, input: opening, inputHistoryText } = spansToSteps(spans);

		expect(opening).toBe("hello");
		expect(inputHistoryText).toBeUndefined();
		expect(steps).toEqual([
			// Part of the conversation, not something the author chose to assert.
			{ kind: "final", text: "Hi! How can I help?", enabled: false },
			// The reply as it was sent, and as history kept it once answered.
			{ kind: "user", text: "<ctx>any meetings?", historyText: "any meetings?" },
			{
				kind: "tool_call",
				name: "searchCalendar",
				args: { mailbox: "" },
				recordedResult: '{"error":"which mailbox?"}',
			},
			{ kind: "final", text: "Which mailbox?" },
			// The last reply is never answered within the session, so it never becomes history.
			{ kind: "user", text: "<ctx>the first one" },
			{ kind: "final", text: "None today." },
		]);
	});

	it("keeps the tool calls of an earlier exchange, with the results history holds", () => {
		const spans = [
			row({ span_type: "user", output: "and tomorrow?" }),
			row({
				span_index: 1,
				input: input(
					user("weather today?"),
					toolCall("c1", "get_weather", { day: "today" }),
					toolResponse("c1", { temp: 12 }),
					assistant("12 degrees."),
					user("and tomorrow?"),
				),
				output: "14 degrees.",
			}),
		];

		const { steps } = spansToSteps(spans);

		expect(steps.slice(0, 2)).toEqual([
			{
				kind: "tool_call",
				name: "get_weather",
				args: { day: "today" },
				enabled: false,
				recordedResult: '{"temp":12}',
			},
			{ kind: "final", text: "12 degrees.", enabled: false },
		]);
	});

	it("reads the message shape most SDKs still emit", () => {
		const spans = [
			row({ span_type: "user", output: "and tomorrow?" }),
			row({
				span_index: 1,
				input: JSON.stringify([
					{ role: "system", content: "be brief" },
					{ role: "user", content: "weather today?" },
					{
						role: "assistant",
						content: null,
						tool_calls: [
							{ id: "c1", function: { name: "get_weather", arguments: '{"day":"today"}' } },
						],
					},
					{ role: "tool", tool_call_id: "c1", content: '{"temp":12}' },
					{ role: "assistant", content: "12 degrees." },
					{ role: "user", content: "and tomorrow?" },
				]),
				output: "14 degrees.",
			}),
		];

		const { steps, input: opening } = spansToSteps(spans);

		expect(opening).toBe("weather today?");
		expect(steps.slice(0, 2)).toEqual([
			{
				kind: "tool_call",
				name: "get_weather",
				args: { day: "today" },
				enabled: false,
				recordedResult: '{"temp":12}',
			},
			{ kind: "final", text: "12 degrees.", enabled: false },
		]);
	});

	it("opens from the question as the first turn sent it, and keeps its history form", () => {
		// Every turn has a log row, and a later turn's row holds the question only as
		// history kept it -- without the context the first turn was answered with.
		const spans = [
			row({ input: input(user("<ctx>any meetings?")), output: "None today." }),
			row({ trace_id: "turn-2", span_type: "user", output: "<ctx>and tomorrow?" }),
			row({
				trace_id: "turn-2",
				span_index: 1,
				input: input(user("any meetings?"), assistant("None today."), user("<ctx>and tomorrow?")),
				output: "One.",
			}),
		];

		const { steps, input: opening, inputHistoryText } = spansToSteps(spans);

		expect(opening).toBe("<ctx>any meetings?");
		expect(inputHistoryText).toBe("any meetings?");
		// Nothing happened before the first turn, so nothing is added in front of it.
		expect(steps).toEqual([
			{ kind: "final", text: "None today." },
			{ kind: "user", text: "<ctx>and tomorrow?" },
			{ kind: "final", text: "One." },
		]);
	});

	it("sets no history form when the history holds a different number of replies", () => {
		// It cannot say which reply is which, and a reply given another's history form
		// replays a conversation that never happened.
		const spans = [
			row({ input: input(user("q1")), output: "a1" }),
			row({ trace_id: "turn-2", span_type: "user", output: "<ctx>q2" }),
			row({ trace_id: "turn-2", span_index: 1, output: "a2" }),
			row({ trace_id: "turn-3", span_type: "user", output: "<ctx>q3" }),
			row({
				trace_id: "turn-3",
				span_index: 1,
				input: input(user("q1"), assistant("a1"), user("<ctx>q3")),
				output: "a3",
			}),
		];

		const { steps } = spansToSteps(spans);

		expect(steps.filter((step) => step.kind === "user")).toEqual([
			{ kind: "user", text: "<ctx>q2" },
			{ kind: "user", text: "<ctx>q3" },
		]);
	});

	it("leaves a session with no recorded input exactly as its rows say", () => {
		const spans = [
			row({ span_type: "llm", output: "a1" }),
			row({ span_index: 1, span_type: "user", output: "q2" }),
			row({ span_index: 2, span_type: "llm", output: "a2" }),
		];

		const trajectory = spansToSteps(spans);

		expect(trajectory.input).toBeUndefined();
		expect(trajectory.inputHistoryText).toBeUndefined();
		expect(trajectory.steps).toEqual([
			{ kind: "final", text: "a1" },
			{ kind: "user", text: "q2" },
			{ kind: "final", text: "a2" },
		]);
	});
});
