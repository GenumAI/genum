import { describe, it, expect, vi } from "vitest";
import { toSpanRows } from "./spans";
import { replayTrajectory } from "@/ai/steps/replay";
import type { Step } from "@/ai/steps/types";

const steps: Step[] = [
	{
		kind: "tool_call",
		name: "get_weather",
		args: { city: "Berlin" },
		recordedResult: '{"temp":12}',
	},
	{ kind: "final", text: "It is 12°" },
];

const baseBatch = {
	trace_id: "t1",
	orgId: 1,
	project_id: 2,
	prompt_id: 3,
	vendor: "OPENAI",
	model: "gpt-5",
};

describe("toSpanRows", () => {
	it("numbers spans in order and stamps the trace id on each", () => {
		const rows = toSpanRows({
			trace_id: "t1",
			orgId: 1,
			project_id: 2,
			prompt_id: 3,
			vendor: "OPENAI",
			model: "gpt-5",
			steps,
		});

		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.span_index)).toEqual([0, 1]);
		expect(rows.every((row) => row.trace_id === "t1")).toBe(true);
	});

	it("writes a tool span with serialized arguments and its recorded result", () => {
		const [tool] = toSpanRows({
			trace_id: "t1",
			orgId: 1,
			project_id: 2,
			prompt_id: 3,
			vendor: "OPENAI",
			model: "gpt-5",
			steps,
		});

		expect(tool.span_type).toBe("tool");
		expect(tool.name).toBe("get_weather");
		expect(JSON.parse(tool.tool_args)).toEqual({ city: "Berlin" });
		expect(tool.tool_result).toBe('{"temp":12}');
	});

	it("writes the final step as an llm span carrying the answer", () => {
		const rows = toSpanRows({
			trace_id: "t1",
			orgId: 1,
			project_id: 2,
			prompt_id: 3,
			vendor: "OPENAI",
			model: "gpt-5",
			steps,
		});

		expect(rows[1].span_type).toBe("llm");
		expect(rows[1].output).toBe("It is 12°");
		expect(rows[1].tool_args).toBe("");
	});

	it("keeps repeated calls to the same tool distinct, each with its own recorded result", () => {
		// Two calls to get_weather with different cities and different results -- a
		// name-keyed map cannot represent this; recordedResult is per-call and must be.
		const repeatedSteps: Step[] = [
			{
				kind: "tool_call",
				name: "get_weather",
				args: { city: "Berlin" },
				recordedResult: '{"temp":12}',
			},
			{
				kind: "tool_call",
				name: "get_weather",
				args: { city: "Tokyo" },
				recordedResult: '{"temp":28}',
			},
		];

		const rows = toSpanRows({
			trace_id: "t1",
			orgId: 1,
			project_id: 2,
			prompt_id: 3,
			vendor: "OPENAI",
			model: "gpt-5",
			steps: repeatedSteps,
		});

		expect(rows).toHaveLength(2);
		expect(rows[0].tool_result).toBe('{"temp":12}');
		expect(rows[1].tool_result).toBe('{"temp":28}');
		expect(rows[0].tool_result).not.toBe(rows[1].tool_result);
	});

	// The seam this table exists for: what a replayed run actually hands the writer.
	// `toSpanRows` reads `recordedResult` off the step, so the guarantee is only real if
	// the replay loop puts it there -- it did not, and every tool span was landing with
	// an empty `tool_result` while this file's own tests passed on hand-built steps.
	it("carries the real, per-call results of a replayed run", async () => {
		const callModel = vi
			.fn()
			.mockResolvedValueOnce({
				answer: "",
				toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Berlin" } }],
			})
			.mockResolvedValueOnce({
				answer: "",
				toolCalls: [{ id: "c2", name: "get_weather", args: { city: "Cairo" } }],
			})
			.mockResolvedValueOnce({ answer: "12° and 28°" });

		const replay = await replayTrajectory({
			callModel,
			recorded: [
				{ kind: "tool_call", name: "get_weather", recordedResult: '{"temp":12}' },
				{ kind: "tool_call", name: "get_weather", recordedResult: '{"temp":28}' },
			],
		});

		const rows = toSpanRows({
			trace_id: "t1",
			orgId: 1,
			project_id: 2,
			prompt_id: 3,
			vendor: "OPENAI",
			model: "gpt-5",
			steps: replay.steps,
		});

		expect(rows.map((row) => row.tool_result)).toEqual(['{"temp":12}', '{"temp":28}', ""]);
		expect(rows.map((row) => row.tool_args)).toEqual([
			'{"city":"Berlin"}',
			'{"city":"Cairo"}',
			"",
		]);
		expect(rows[2].output).toBe("12° and 28°");
	});

	it("writes an empty tool_result when the step has no recordedResult", () => {
		const [tool] = toSpanRows({
			trace_id: "t1",
			orgId: 1,
			project_id: 2,
			prompt_id: 3,
			vendor: "OPENAI",
			model: "gpt-5",
			steps: [{ kind: "tool_call", name: "get_weather", args: { city: "Berlin" } }],
		});

		expect(tool.tool_result).toBe("");
	});

	it("writes a user reply as its own span, carrying the text", () => {
		const rows = toSpanRows({
			...baseBatch,
			steps: [{ kind: "user", text: "and in London?" }],
		});
		expect(rows[0].span_type).toBe("user");
		expect(rows[0].output).toBe("and in London?");
		expect(rows[0].tool_args).toBe("");
		expect(rows[0].tool_result).toBe("");
	});

	it("numbers spans across every kind, not only tool calls", () => {
		const rows = toSpanRows({
			...baseBatch,
			spanIndexOffset: 3,
			steps: [
				{ kind: "user", text: "again" },
				{ kind: "tool_call", name: "t", recordedResult: "{}" },
				{ kind: "final", text: "done" },
			],
		});
		expect(rows.map((r) => r.span_index)).toEqual([3, 4, 5]);
	});
});
