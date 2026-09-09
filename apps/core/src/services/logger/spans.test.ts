import { describe, it, expect, vi } from "vitest";
import { deriveTurnTraceId, toSpanRows } from "./spans";
import { replayTrajectory } from "@/ai/steps/replay";
import type { Step } from "@/ai/steps/types";
import { uuidSchema } from "@/services/validate/types/generic.type";

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
	session_id: "s1",
	turn_index: 0,
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
			session_id: "s1",
			turn_index: 0,
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
			session_id: "s1",
			turn_index: 0,
			orgId: 1,
			project_id: 2,
			prompt_id: 3,
			vendor: "OPENAI",
			model: "gpt-5",
			steps,
		});

		expect(tool.span_type).toBe("execute_tool");
		expect(tool.name).toBe("execute_tool get_weather");
		expect(JSON.parse(tool.tool_args)).toEqual({ city: "Berlin" });
		expect(tool.tool_result).toBe('{"temp":12}');
	});

	it("writes the final step as an llm span carrying the answer", () => {
		const rows = toSpanRows({
			trace_id: "t1",
			session_id: "s1",
			turn_index: 0,
			orgId: 1,
			project_id: 2,
			prompt_id: 3,
			vendor: "OPENAI",
			model: "gpt-5",
			steps,
		});

		expect(rows[1].span_type).toBe("chat");
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
			session_id: "s1",
			turn_index: 0,
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
			session_id: "s1",
			turn_index: 0,
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
			session_id: "s1",
			turn_index: 0,
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
		// Not the model's name: the model did not write this, and the row is permanent.
		expect(rows[0].name).not.toBe(baseBatch.model);
		expect(rows[0].name).toBe("user reply");
		expect(rows[0].tool_args).toBe("");
		expect(rows[0].tool_result).toBe("");
	});

	it("numbers spans across every kind, not only tool calls", () => {
		const rows = toSpanRows({
			...baseBatch,
			steps: [
				{ kind: "user", text: "again" },
				{ kind: "tool_call", name: "t", recordedResult: "{}" },
				{ kind: "final", text: "done" },
			],
		});
		expect(rows.map((r) => r.span_index)).toEqual([0, 1, 2]);
	});

	it("numbers a turn's spans from zero and stamps the session and turn on each", () => {
		// The offset is gone. Under the old model a batch had to be told how many spans
		// preceded it, and a batch that was told wrongly wrote onto indices already taken --
		// permanently, in an append-only table. A turn now owns its own numbering.
		const rows = toSpanRows({
			trace_id: "turn-trace",
			session_id: "session-1",
			turn_index: 2,
			orgId: 1,
			project_id: 2,
			prompt_id: 3,
			vendor: "openai",
			model: "gpt-4",
			steps: [
				{ kind: "tool_call", name: "weather", args: { city: "Paris" }, recordedResult: "12" },
				{ kind: "final", text: "12 in Paris" },
			],
		});

		expect(rows.map((row) => row.span_index)).toEqual([0, 1]);
		expect(rows.every((row) => row.session_id === "session-1")).toBe(true);
		expect(rows.every((row) => row.turn_index === 2)).toBe(true);
		expect(rows.every((row) => row.trace_id === "turn-trace")).toBe(true);
	});

	it("names spans the way the GenAI conventions do", () => {
		// `gen_ai.operation.name` values, and `{operation} {model|tool}` for the span name.
		// This is the cheap half of ingest compatibility: a conforming span then maps field
		// to field instead of being interpreted.
		const rows = toSpanRows({
			trace_id: "t",
			session_id: "s",
			turn_index: 0,
			orgId: 1,
			project_id: 2,
			prompt_id: 3,
			vendor: "openai",
			model: "gpt-4",
			steps: [
				{ kind: "tool_call", name: "weather", args: {}, recordedResult: "{}" },
				{ kind: "final", text: "done" },
				{ kind: "user", text: "and London?" },
			],
		});

		expect(rows[0]).toMatchObject({ span_type: "execute_tool", name: "execute_tool weather" });
		expect(rows[1]).toMatchObject({ span_type: "chat", name: "chat gpt-4" });
		// The reply is ours, not the conventions': there a human turn is an entry in
		// `gen_ai.input.messages`, not a span. Its name must still not be the model's.
		expect(rows[2]).toMatchObject({ span_type: "user", name: "user reply" });
	});
});

describe("deriveTurnTraceId", () => {
	it("is stable for the same session and turn index, so a retried write lands on the same trace", () => {
		expect(deriveTurnTraceId("session-1", 0)).toBe(deriveTurnTraceId("session-1", 0));
	});

	it("differs across turn indices within the same session", () => {
		expect(deriveTurnTraceId("session-1", 0)).not.toBe(deriveTurnTraceId("session-1", 1));
	});

	it("differs across sessions for the same turn index", () => {
		expect(deriveTurnTraceId("session-1", 0)).not.toBe(deriveTurnTraceId("session-2", 0));
	});

	it("is a VALID uuid, not merely uuid-shaped", () => {
		// Shape alone is not enough. Nothing validates `trace_id` on the way in, so a
		// value with hash nibbles where the version and variant belong passes unnoticed
		// here and fails wherever something does validate -- `uuidSchema` is `z.uuid()`,
		// which rejects roughly six of every seven raw-hash values. Checked over many
		// inputs because a single sample passes by luck about one time in seven.
		for (let turn = 0; turn < 50; turn++) {
			expect(uuidSchema.safeParse(deriveTurnTraceId("session-1", turn)).success).toBe(true);
			expect(uuidSchema.safeParse(deriveTurnTraceId(`s-${turn}`, 0)).success).toBe(true);
		}
	});
});
