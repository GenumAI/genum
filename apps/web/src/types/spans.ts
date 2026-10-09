import type { SpanRow as StoredSpanRow } from "@genum/steps";

/**
 * A `trace_spans` row as this side reads it: the `SpanRow` core writes and returns (from
 * @genum/steps), narrowed to what the web app relies on. `tool_args` is a JSON *string* --
 * `JSON.stringify(step.args ?? {})` on the way in. `span_type` values `llm`/`tool` are
 * legacy.
 *
 * Deliberately no `session_id` / `turn_index` here, even though the stored row has them:
 * this side renders a session the server has already selected and ordered, so it never
 * needs to group or order rows by either column itself. Not an oversight. `source` was
 * never part of this view either.
 *
 * `placeholders`, `tools_offered` and `prompt_version` are what the turn was run WITH, as
 * its sender recorded it. Optional because a row written before these columns existed
 * carries none of them, and empty because a sender that supplies no such attribute
 * records none -- in both cases the meaning is "not recorded", never "no tools" or "no
 * selection". `sessionSelections` is the one place that reads them; see the note there on
 * why empty cannot mean none.
 */
export type SpanRow = Omit<
	StoredSpanRow,
	"session_id" | "turn_index" | "source" | "placeholders" | "tools_offered" | "prompt_version"
> &
	Partial<Pick<StoredSpanRow, "placeholders" | "tools_offered" | "prompt_version">>;

export interface TraceSpansResponse {
	spans: SpanRow[];
}
