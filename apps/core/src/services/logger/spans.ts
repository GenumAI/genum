import { randomUUID } from "node:crypto";
import type { Step } from "@/ai/steps/types";

export type SpanRow = {
	/**
	 * Set by ClickHouse (`DEFAULT now64()`), so it is absent on the way in and present on
	 * every row read back out.
	 */
	timestamp?: string;
	trace_id: string;
	/**
	 * The conversation this turn belongs to. Empty on every row written before the session
	 * model, where one trace WAS the session -- the read path treats empty as "this trace
	 * is a session by itself", which is true of those rows and of any ingested trace whose
	 * sender had no conversation id to give (the GenAI conventions forbid inventing one).
	 */
	session_id: string;
	/** The turn's ordinal in the session, 0-based. Derived by us; not a protocol field. */
	turn_index: number;
	span_id: string;
	parent_span_id: string | null;
	span_index: number;
	/**
	 * `user` is a reply the human typed to continue the session; its text is in `output`.
	 * Without it a multi-turn trace cannot be read back -- every non-tool span would look
	 * like a model answer, and the root `logs` row records only the session's first question.
	 */
	span_type: "llm" | "tool" | "user";
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
	session_id: string;
	turn_index: number;
};

export function toSpanRows(batch: SpanBatch): SpanRow[] {
	return batch.steps.map((step, index) => ({
		trace_id: batch.trace_id,
		session_id: batch.session_id,
		turn_index: batch.turn_index,
		span_id: randomUUID(),
		parent_span_id: null,
		span_index: index,
		span_type: step.kind === "tool_call" ? "tool" : step.kind === "user" ? "user" : "llm",
		orgId: batch.orgId,
		project_id: batch.project_id,
		prompt_id: batch.prompt_id,
		// A tool span is named for its tool and an `llm` span for the model that produced
		// it. A user reply was produced by neither: stamping the model's name on it says,
		// durably and in an append-only table nobody can correct later, that the model
		// wrote words the author typed.
		name:
			step.kind === "tool_call"
				? step.name
				: step.kind === "user"
					? "user reply"
					: batch.model,
		input: "",
		output: step.kind === "final" ? step.text : step.kind === "user" ? step.text : "",
		tool_args: step.kind === "tool_call" ? JSON.stringify(step.args ?? {}) : "",
		tool_result: step.kind === "tool_call" ? (step.recordedResult ?? "") : "",
		tool_error: null,
		vendor: batch.vendor,
		model: batch.model,
		// Placeholders, not measurements. A step carries no usage or timing of its own --
		// the model's tokens and latency are billed once on the run's root `logs` row, and
		// no tool is ever executed, so there is nothing to time. Written as zeros to keep
		// the columns non-null and the OTel-shaped schema intact; a reader of `trace_spans`
		// must not take them for a tool that genuinely cost 0 and took 0 ms.
		tokens_in: 0,
		tokens_out: 0,
		cost: 0,
		duration_ms: 0,
		status: "OK",
	}));
}
