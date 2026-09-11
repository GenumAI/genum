import { describe, expect, it } from "vitest";

import { isSingleAnswer, spansToSteps } from "./spansToSteps";
import type { SpanRow } from "@/types/spans";

function row(overrides: Partial<SpanRow>): SpanRow {
	return {
		trace_id: "trace-1",
		span_id: "span-1",
		parent_span_id: null,
		span_index: 0,
		span_type: "llm",
		orgId: 1,
		project_id: 2,
		prompt_id: 3,
		name: "gpt-4o",
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

describe("spansToSteps", () => {
	it("turns a tool row back into a tool_call step with parsed args", () => {
		const { steps } = spansToSteps([
			row({
				span_type: "tool",
				name: "get_weather",
				tool_args: '{"city":"Berlin"}',
				tool_result: '{"temp":12}',
			}),
		]);

		expect(steps).toEqual([
			{
				kind: "tool_call",
				name: "get_weather",
				args: { city: "Berlin" },
				recordedResult: '{"temp":12}',
			},
		]);
	});

	it("turns an llm row back into a final step carrying its output", () => {
		const { steps } = spansToSteps([row({ span_type: "llm", output: "It is 12 degrees." })]);
		expect(steps).toEqual([{ kind: "final", text: "It is 12 degrees." }]);
	});

	it("carries recordedResult through untouched -- it is what keeps the testcase replayable", () => {
		const recorded = "a result with \"quotes\", newlines\n and unicode ✓";
		const {
			steps: [step],
		} = spansToSteps([
			row({ span_type: "tool", name: "t", tool_args: "{}", tool_result: recorded }),
		]);

		expect(step).toMatchObject({ kind: "tool_call", recordedResult: recorded });
	});

	it("preserves the order the rows arrive in rather than re-sorting", () => {
		// The read path already orders by span_index; these rows deliberately carry
		// indices that would reorder if this mapper sorted them itself.
		const { steps } = spansToSteps([
			row({ span_type: "tool", span_index: 7, name: "first", tool_args: "{}" }),
			row({ span_type: "tool", span_index: 2, name: "second", tool_args: "{}" }),
			row({ span_type: "llm", span_index: 5, output: "done" }),
		]);

		expect(steps.map((s) => (s.kind === "tool_call" ? s.name : s.text))).toEqual([
			"first",
			"second",
			"done",
		]);
	});

	it("does not assume a trailing final step", () => {
		const { steps } = spansToSteps([
			row({ span_type: "tool", name: "search", tool_args: "{}" }),
			row({ span_type: "tool", name: "search", tool_args: "{}" }),
		]);

		expect(steps).toHaveLength(2);
		expect(steps.every((s) => s.kind === "tool_call")).toBe(true);
	});

	it("returns an empty trajectory for an empty trace", () => {
		const { steps, unreadableArgsIndices } = spansToSteps([]);
		expect(steps).toEqual([]);
		expect(unreadableArgsIndices).toEqual(new Set());
	});

	// A ClickHouse row is not trusted input. Each of these would throw or produce a
	// non-object out of JSON.parse; none of them may take down the dialog.
	it.each([
		["malformed", '{"city":'],
		["truncated", '{"city":"Ber'],
		["empty", ""],
		["null", "null"],
		["an array", '["a","b"]'],
		["a scalar", "5"],
	])("degrades %s tool_args to ignored empty args instead of throwing", (_label, toolArgs) => {
		const { steps, unreadableArgsIndices } = spansToSteps([
			row({ span_type: "tool", name: "get_weather", tool_args: toolArgs, tool_result: "r" }),
		]);

		expect(steps).toEqual([
			{
				kind: "tool_call",
				name: "get_weather",
				args: {},
				argsMatch: "ignore",
				recordedResult: "r",
			},
		]);
		// The marker is out-of-band, never on the step itself -- `steps[0]` above has no
		// extra key, so it can never leak into the createTestcase payload.
		expect(unreadableArgsIndices).toEqual(new Set([0]));
	});

	it("keeps the good steps of a trace that contains one bad row", () => {
		const { steps, unreadableArgsIndices } = spansToSteps([
			row({ span_type: "tool", name: "ok", tool_args: '{"a":1}' }),
			row({ span_type: "tool", name: "bad", tool_args: "{oops" }),
			row({ span_type: "llm", output: "done" }),
		]);

		expect(steps).toHaveLength(3);
		expect(steps[0]).toMatchObject({ name: "ok", args: { a: 1 } });
		expect(steps[1]).toMatchObject({ name: "bad", argsMatch: "ignore" });
		expect(steps[2]).toEqual({ kind: "final", text: "done" });
		expect(unreadableArgsIndices).toEqual(new Set([1]));
	});

	it("does not mark a genuinely no-args call as unreadable", () => {
		const { unreadableArgsIndices } = spansToSteps([
			row({ span_type: "tool", name: "ping", tool_args: "{}" }),
		]);

		expect(unreadableArgsIndices.size).toBe(0);
	});

	it("rebuilds a user reply from its span", () => {
		const { steps } = spansToSteps([
			row({ span_type: "tool", name: "t", tool_result: "{}" }),
			row({ span_type: "llm", output: "one" }),
			row({ span_type: "user", output: "and in London?" }),
			row({ span_type: "llm", output: "two" }),
		]);
		expect(steps[2]).toEqual({ kind: "user", text: "and in London?" });
	});

	it("reads both the old vocabulary and the new one", () => {
		// Rows written before the session model say `llm`/`tool` and are never rewritten --
		// ClickHouse is append-only here. Both vocabularies are permanent, not a migration.
		const { steps } = spansToSteps([
			row({ span_type: "tool", name: "weather", tool_args: "{}", tool_result: "12" }),
			row({ span_type: "llm", output: "old answer" }),
			row({ span_type: "execute_tool", name: "weather", tool_args: "{}", tool_result: "9" }),
			row({ span_type: "chat", output: "new answer" }),
		]);

		expect(steps.map((step) => step.kind)).toEqual(["tool_call", "final", "tool_call", "final"]);
	});

	it("gives a tool step the tool's own name, not the span's operation-prefixed one", () => {
		// `replayTrajectory` matches a recorded call by name. A step called
		// "execute_tool weather" matches nothing the model ever calls, so every testcase
		// pinned from a new-vocabulary trace would stop at `missing_recording`.
		const { steps } = spansToSteps([
			row({ span_type: "execute_tool", name: "execute_tool weather", tool_args: "{}" }),
		]);

		expect(steps[0]).toMatchObject({ kind: "tool_call", name: "weather" });
	});
});

describe("isSingleAnswer", () => {
	it("is true for a session that is one plain answer", () => {
		// The shape every ordinary run now records, and the whole reason the predicate
		// exists: this must not open the step picker or render a trajectory.
		expect(isSingleAnswer([{ kind: "final", text: "sunny" }])).toBe(true);
	});

	it("is false for two turns of plain answers, with no tool anywhere", () => {
		// The discriminating case. A rule written as "contains no tool call" would call
		// this single too -- and a two-turn conversation IS worth pinning, because a plain
		// text testcase cannot express a follow-up.
		expect(
			isSingleAnswer([
				{ kind: "final", text: "hi" },
				{ kind: "user", text: "the real question" },
				{ kind: "final", text: "the real answer" },
			]),
		).toBe(false);
	});

	it("is false as soon as a tool was called", () => {
		expect(
			isSingleAnswer([
				{ kind: "tool_call", name: "weather", args: {} },
				{ kind: "final", text: "12 degrees" },
			]),
		).toBe(false);
	});

	it("is true for no steps at all", () => {
		// An abandoned turn records none. Callers that want to say something about that
		// case test the length themselves; this predicate says only that there is nothing
		// to pick from, which is true of an empty session.
		expect(isSingleAnswer([])).toBe(true);
	});
});

describe("spansToSteps: what is not a step", () => {
	it("drops a model call that only asked for tools", () => {
		// Its output has no text part, so "" was stored for it. As a `final` step that
		// pinned an expectation of the empty string in the middle of a turn, which no
		// replay can satisfy -- every testcase from such a session failed by construction.
		const { steps } = spansToSteps([
			row({ span_type: "chat", output: "" }),
			row({ span_type: "execute_tool", name: "execute_tool get_weather", tool_args: "{}" }),
			row({ span_type: "chat", output: "It is 12 degrees." }),
		]);

		expect(steps).toEqual([
			{ kind: "tool_call", name: "get_weather", args: {}, recordedResult: "" },
			{ kind: "final", text: "It is 12 degrees." },
		]);
	});

	it("drops a span whose operation we do not model", () => {
		// A standard instrumentation emits these freely. Each one used to become a `final`,
		// so pinning a session asserted its embedding calls as expected answers.
		const { steps } = spansToSteps([
			row({ span_type: "embeddings" as SpanRow["span_type"], output: "[0.1, 0.2]" }),
			row({ span_type: "chat", output: "Done." }),
		]);

		expect(steps).toEqual([{ kind: "final", text: "Done." }]);
	});

	it("drops a span that never said what operation it is", () => {
		const { steps } = spansToSteps([
			row({ span_type: "" as SpanRow["span_type"], output: "something" }),
			row({ span_type: "chat", output: "Done." }),
		]);

		expect(steps).toEqual([{ kind: "final", text: "Done." }]);
	});

	it("keeps a user reply even though its output is the only thing it carries", () => {
		const { steps } = spansToSteps([
			row({ span_type: "user", output: "and tomorrow?" }),
			row({ span_type: "chat", output: "Also 12." }),
		]);

		expect(steps).toEqual([
			{ kind: "user", text: "and tomorrow?" },
			{ kind: "final", text: "Also 12." },
		]);
	});

	it("marks the produced step as unreadable, not the span's position", () => {
		// The two used to be the same number because every span became a step. With spans
		// that are dropped, indexing by span position marks the wrong row -- or one that
		// does not exist.
		const { steps, unreadableArgsIndices } = spansToSteps([
			row({ span_type: "chat", output: "" }),
			row({ span_type: "embeddings" as SpanRow["span_type"] }),
			row({ span_type: "execute_tool", name: "execute_tool get_weather", tool_args: "{{" }),
		]);

		expect(steps).toHaveLength(1);
		expect([...unreadableArgsIndices]).toEqual([0]);
	});
});
