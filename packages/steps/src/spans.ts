/**
 * One row of `trace_spans`: a step as it is recorded, and the shape the trace spans read
 * returns. Core writes it (`toSpanRows`, OTLP ingest) and reads it back; the web app turns
 * it back into steps. The id derivation and the step-to-row mapping stay in core, which
 * needs `node:crypto` for them -- only the shape is shared.
 */
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
	 * `gen_ai.operation.name` from the GenAI conventions, so an ingested span maps field to
	 * field. `user` is ours and has no counterpart there -- a human reply is an entry in
	 * `gen_ai.input.messages` on the chat span, not a span -- but the replay engine and the
	 * comparison need the reply as an addressable step, so it stays as our normal form.
	 *
	 * `llm` and `tool` are the vocabulary rows written before the session model carry. They
	 * are never written again and never rewritten, so readers accept them permanently.
	 */
	span_type: "chat" | "execute_tool" | "user" | "llm" | "tool";
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
	/**
	 * Which system produced this span: `genum` for our own runs, `otlp` for a customer's
	 * trace we ingested. Load-bearing rather than informational -- ingested traces are not
	 * metered, and that decision can only be revisited while the rows still say which is
	 * which, because this table is append-only.
	 */
	source: SpanSource;
	/**
	 * What this turn was run WITH, as its sender recorded it. Empty means "not recorded",
	 * never "none" -- every row written before these columns existed, and every sender that
	 * supplies no such attribute, reads back empty and must keep replaying the way it did
	 * before rather than suddenly replay with no tools and default placeholder values.
	 *
	 * `placeholders` maps a key to the NAME of the value it resolved to, not to that
	 * value's content: the content belongs to the prompt and can be edited afterwards,
	 * while the selection is what the turn actually made. Same shape, same reasoning, as
	 * the column of the same name on `logs`.
	 *
	 * `tools_offered` is names only. The definitions are the prompt's; a replay needs to
	 * know which subset was on the table, not to rebuild them from the trace.
	 */
	placeholders: Record<string, string>;
	tools_offered: string[];
	/** `commitHash` of the prompt version this turn rendered from, when the sender said. */
	prompt_version: string;
};

export type SpanSource = "genum" | "otlp";
