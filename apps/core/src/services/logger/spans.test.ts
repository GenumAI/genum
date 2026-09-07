import { describe, it, expect } from "vitest";
import { toSpanRows } from "./spans";
import type { Step } from "@/ai/steps/types";

const steps: Step[] = [
	{ kind: "tool_call", name: "get_weather", args: { city: "Berlin" } },
	{ kind: "final", text: "It is 12°" },
];

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
			results: { get_weather: '{"temp":12}' },
		});

		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.span_index)).toEqual([0, 1]);
		expect(rows.every((row) => row.trace_id === "t1")).toBe(true);
	});

	it("writes a tool span with serialized arguments and its result", () => {
		const [tool] = toSpanRows({
			trace_id: "t1",
			orgId: 1,
			project_id: 2,
			prompt_id: 3,
			vendor: "OPENAI",
			model: "gpt-5",
			steps,
			results: { get_weather: '{"temp":12}' },
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
			results: {},
		});

		expect(rows[1].span_type).toBe("llm");
		expect(rows[1].output).toBe("It is 12°");
		expect(rows[1].tool_args).toBe("");
	});
});
