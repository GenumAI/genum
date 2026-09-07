import { describe, expect, it } from "vitest";

import { spansToSteps } from "./spansToSteps";
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
		const steps = spansToSteps([
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
		expect(spansToSteps([row({ span_type: "llm", output: "It is 12 degrees." })])).toEqual([
			{ kind: "final", text: "It is 12 degrees." },
		]);
	});

	it("carries recordedResult through untouched -- it is what keeps the testcase replayable", () => {
		const recorded = "a result with \"quotes\", newlines\n and unicode ✓";
		const [step] = spansToSteps([
			row({ span_type: "tool", name: "t", tool_args: "{}", tool_result: recorded }),
		]);

		expect(step).toMatchObject({ kind: "tool_call", recordedResult: recorded });
	});

	it("preserves the order the rows arrive in rather than re-sorting", () => {
		// The read path already orders by span_index; these rows deliberately carry
		// indices that would reorder if this mapper sorted them itself.
		const steps = spansToSteps([
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
		const steps = spansToSteps([
			row({ span_type: "tool", name: "search", tool_args: "{}" }),
			row({ span_type: "tool", name: "search", tool_args: "{}" }),
		]);

		expect(steps).toHaveLength(2);
		expect(steps.every((s) => s.kind === "tool_call")).toBe(true);
	});

	it("returns an empty trajectory for an empty trace", () => {
		expect(spansToSteps([])).toEqual([]);
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
		const steps = spansToSteps([
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
	});

	it("keeps the good steps of a trace that contains one bad row", () => {
		const steps = spansToSteps([
			row({ span_type: "tool", name: "ok", tool_args: '{"a":1}' }),
			row({ span_type: "tool", name: "bad", tool_args: "{oops" }),
			row({ span_type: "llm", output: "done" }),
		]);

		expect(steps).toHaveLength(3);
		expect(steps[0]).toMatchObject({ name: "ok", args: { a: 1 } });
		expect(steps[1]).toMatchObject({ name: "bad", argsMatch: "ignore" });
		expect(steps[2]).toEqual({ kind: "final", text: "done" });
	});
});
