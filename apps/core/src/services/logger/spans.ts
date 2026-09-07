import { randomUUID } from "node:crypto";
import type { Step } from "@/ai/steps/types";

export type SpanRow = {
	trace_id: string;
	span_id: string;
	parent_span_id: string | null;
	span_index: number;
	span_type: "llm" | "tool";
	orgId: number;
	project_id: number;
	prompt_id: number;
	name: string;
	input: string;
	output: string;
	tool_args: string;
	tool_result: string;
	tool_error: string | null;
	vendor: string;
	model: string;
	tokens_in: number;
	tokens_out: number;
	cost: number;
	duration_ms: number;
	status: string;
};

export type SpanBatch = {
	trace_id: string;
	orgId: number;
	project_id: number;
	prompt_id: number;
	vendor: string;
	model: string;
	steps: Step[];
};

export function toSpanRows(batch: SpanBatch): SpanRow[] {
	return batch.steps.map((step, index) => ({
		trace_id: batch.trace_id,
		span_id: randomUUID(),
		parent_span_id: null,
		span_index: index,
		span_type: step.kind === "tool_call" ? "tool" : "llm",
		orgId: batch.orgId,
		project_id: batch.project_id,
		prompt_id: batch.prompt_id,
		name: step.kind === "tool_call" ? step.name : batch.model,
		input: "",
		output: step.kind === "final" ? step.text : "",
		tool_args: step.kind === "tool_call" ? JSON.stringify(step.args ?? {}) : "",
		tool_result: step.kind === "tool_call" ? (step.recordedResult ?? "") : "",
		tool_error: null,
		vendor: batch.vendor,
		model: batch.model,
		tokens_in: 0,
		tokens_out: 0,
		cost: 0,
		duration_ms: 0,
		status: "OK",
	}));
}
