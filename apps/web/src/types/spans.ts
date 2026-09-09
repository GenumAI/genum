// apps/web does not depend on apps/core, so this shape is restated here rather than
// imported -- the same reason the step shapes are restated in `types/steps.ts`.
// Mirrors `SpanRow` in apps/core/src/services/logger/spans.ts.

export interface SpanRow {
	/** Set by ClickHouse on insert, so it is present on every row read back. */
	timestamp?: string;
	trace_id: string;
	// Deliberately no `session_id` / `turn_index` here, even though core's `SpanRow` has
	// them: this side renders a session the server has already selected and ordered, so it
	// never needs to group or order rows by either column itself. Not an oversight.
	span_id: string;
	parent_span_id: string | null;
	span_index: number;
	/** Mirrors `SpanRow` in apps/core/src/services/logger/spans.ts. `llm`/`tool` are legacy. */
	span_type: "chat" | "execute_tool" | "user" | "llm" | "tool";
	orgId: number;
	project_id: number;
	prompt_id: number;
	name: string;
	input: string;
	output: string;
	/** JSON *string* -- `JSON.stringify(step.args ?? {})` on the way in. */
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
}

export interface TraceSpansResponse {
	spans: SpanRow[];
}
