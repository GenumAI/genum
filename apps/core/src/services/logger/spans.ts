import { createHash } from "node:crypto";
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
};

export type SpanSource = "genum" | "otlp";

/**
 * The turn's trace id, derived from `(session_id, turn_index)` rather than minted with
 * `randomUUID`. OTLP delivers at least once and the playground retries a turn-ending
 * request it never got a response for, so the same turn can be written twice. Dedup on
 * `(trace_id, span_id)` is the queued remedy for that -- but it only works if the retry
 * lands on the SAME trace id as the original write. A random id defeats it: the retry
 * would mint a different trace carrying the same `turn_index`, dedup would never see the
 * two as related, and the session would read back with that turn duplicated and
 * interleaved (both traces tie on `span_index` under `ORDER BY turn_index, span_index`).
 * Deriving the id here instead makes a retry of the same turn produce the same trace id,
 * which is what lets that dedup collapse it.
 */
function derivedUuid(seed: string): string {
	const hex = createHash("sha256").update(seed).digest("hex");
	// Stamped into a well-formed v5 UUID rather than left as raw hash nibbles. A
	// UUID-SHAPED value that is not a valid UUID passes unnoticed here -- nothing validates
	// these columns today -- and then fails somewhere that does: `uuidSchema` is `z.uuid()`,
	// which rejects roughly six of every seven raw-hash values. The ingest and dedup work
	// these ids exist to keep reachable is exactly the work that would hit it.
	const version = `5${hex.slice(13, 16)}`;
	const variant = `${((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`;
	return [hex.slice(0, 8), hex.slice(8, 12), version, variant, hex.slice(20, 32)].join("-");
}

export function deriveTurnTraceId(sessionId: string, turnIndex: number): string {
	return derivedUuid(`${sessionId}:${turnIndex}`);
}

/**
 * The span's id, derived from `(trace_id, span_index)` rather than minted with
 * `randomUUID`.
 *
 * The other half of the pair `deriveTurnTraceId` began. Deduplication is on
 * `(trace_id, span_id)`, so a stable trace id buys nothing while the span id is random:
 * a retried write lands on the same trace with a brand new span id, the two rows match on
 * nothing, and the duplicate is permanent in a table that cannot be rewritten. Derived,
 * the retry reproduces the row exactly and the read collapses it.
 *
 * Shares `derivedUuid` with the trace id on purpose: two hand-copied stamping routines
 * are two things that can drift into different formats in one column.
 */
export function deriveSpanId(traceId: string, spanIndex: number): string {
	return derivedUuid(`${traceId}#${spanIndex}`);
}

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
	/** Defaults to `genum`: everything written through this function is our own run. */
	source?: SpanSource;
};

export function toSpanRows(batch: SpanBatch): SpanRow[] {
	return batch.steps.map((step, index) => ({
		trace_id: batch.trace_id,
		session_id: batch.session_id,
		turn_index: batch.turn_index,
		span_id: deriveSpanId(batch.trace_id, index),
		parent_span_id: null,
		span_index: index,
		span_type:
			step.kind === "tool_call" ? "execute_tool" : step.kind === "user" ? "user" : "chat",
		orgId: batch.orgId,
		project_id: batch.project_id,
		prompt_id: batch.prompt_id,
		// A tool span is named for its tool and an `llm` span for the model that produced
		// it. A user reply was produced by neither: stamping the model's name on it says,
		// durably and in an append-only table nobody can correct later, that the model
		// wrote words the author typed.
		name:
			step.kind === "tool_call"
				? `execute_tool ${step.name}`
				: step.kind === "user"
					? "user reply"
					: `chat ${batch.model}`,
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
		source: batch.source ?? "genum",
	}));
}
