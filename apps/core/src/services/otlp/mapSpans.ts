import { formatClickHouseTimestamp } from "@/services/logger/mappers";
import { deriveSpanId } from "@/services/logger/spans";
import type { SpanRow } from "@/services/logger/spans";
import { compareNanos } from "./turnIndex";
import type { OtlpAnyValue, OtlpMapContext, OtlpMapResult, OtlpPayload, OtlpSpan } from "./types";

/**
 * An OTLP/HTTP JSON trace payload turned into `trace_spans` rows.
 *
 * Pure on purpose: no database, no Express, no clock beyond a fallback for a span that
 * arrived without a start time. Everything that can be got wrong about the mapping is
 * decided here and tested here, which is why the endpoint above it has almost no logic.
 *
 * A span it cannot store is rejected with a reason rather than thrown: OTLP expresses
 * "some of this batch landed" as a partial success, and a collector that gets an error
 * for the whole batch resends the spans that already landed.
 */
export function mapOtlpSpans(payload: OtlpPayload, context: OtlpMapContext): OtlpMapResult {
	const reasons: string[] = [];
	let rejected = 0;

	const accepted: OtlpSpan[] = [];
	for (const span of flatten(payload)) {
		const reason = whyUnusable(span, context);
		if (reason) {
			rejected += 1;
			reasons.push(reason);
			continue;
		}
		accepted.push(span);
	}

	const turnIndexOf = turnIndices(accepted, context);
	const rows: SpanRow[] = [];

	for (const [traceId, spans] of groupByTrace(accepted)) {
		const turnIndex = turnIndexOf(traceId);
		const ordered = [...spans].sort(byStartTime);
		const sessionId = attr(ordered[0], "gen_ai.conversation.id") ?? "";

		// The human reply that provoked this turn, from the chat span's input messages
		// (S2). It goes first: everything else in the turn happened because of it.
		const reply = turnIndex === 0 ? undefined : lastUserMessage(ordered);
		if (reply !== undefined) {
			rows.push({
				...base(ordered[0], context, traceId, sessionId, turnIndex, 0),
				// Derived, not sent, so it has no id of the sender's to keep. Derived from
				// `(trace_id, span_index)` rather than minted at random for the same reason
				// our own writer does it: a redelivery must reproduce this row exactly, or
				// dedup has nothing to collapse and the reply is stored twice.
				span_id: deriveSpanId(traceId, 0),
				parent_span_id: null,
				span_index: 0,
				span_type: "user",
				name: "user reply",
				output: reply,
			});
		}

		ordered.forEach((span, index) => {
			const spanIndex = reply === undefined ? index : index + 1;
			rows.push({
				...base(span, context, traceId, sessionId, turnIndex, spanIndex),
				// Verbatim (S4). A 16-hex span id stays 16 hex: an id we re-encoded cannot
				// be pasted into the sender's own tracing UI, which is most of the reason
				// they would open this page at all.
				span_id: String(span.spanId),
				parent_span_id: span.parentSpanId ? span.parentSpanId : null,
				span_index: spanIndex,
			});
		});
	}

	return { rows, rejected, reasons };
}

function base(
	span: OtlpSpan,
	context: OtlpMapContext,
	traceId: string,
	sessionId: string,
	turnIndex: number,
	spanIndex: number,
): SpanRow {
	const operation = attr(span, "gen_ai.operation.name") ?? "chat";
	return {
		timestamp: toClickHouseTime(span.startTimeUnixNano),
		trace_id: traceId,
		session_id: sessionId,
		turn_index: turnIndex,
		span_id: String(span.spanId),
		parent_span_id: span.parentSpanId ? span.parentSpanId : null,
		span_index: spanIndex,
		// Stored as sent, even for an operation we do not model. Rendering it inertly costs
		// nothing; refusing it loses a span the author may want to see, over a vocabulary
		// the conventions leave open.
		span_type: operation as SpanRow["span_type"],
		orgId: context.orgId,
		project_id: context.projectId,
		prompt_id: promptIdOf(span, context) as number,
		name: span.name ?? operation,
		input: attr(span, "gen_ai.input.messages") ?? "",
		output: attr(span, "gen_ai.output.messages") ?? "",
		tool_args: attr(span, "gen_ai.tool.call.arguments") ?? "",
		tool_result: attr(span, "gen_ai.tool.call.result") ?? "",
		tool_error: span.status?.message ?? null,
		vendor: attr(span, "gen_ai.system") ?? "",
		model: attr(span, "gen_ai.request.model") ?? "",
		// Displayed, never summed with our own runs' usage: these numbers are the sender's
		// claim about their own traffic, not something we measured or billed.
		tokens_in: intAttr(span, "gen_ai.usage.input_tokens"),
		tokens_out: intAttr(span, "gen_ai.usage.output_tokens"),
		// Zero because ingested traces are not metered. `source` is what keeps that
		// revisitable -- this table is append-only, so a row that does not say it was
		// ingested can never be made to.
		cost: 0,
		duration_ms: durationOf(span),
		status: span.status?.code === undefined ? "OK" : String(span.status.code),
		source: "otlp",
	};
}

/**
 * The traces a payload carries: their session, and when each one started.
 *
 * The endpoint needs this BEFORE mapping, because numbering a turn takes a read of what
 * the session already holds and the mapping needs the ordinals it produces. Reading it
 * from the payload twice is cheaper than making the mapping impure.
 */
export function tracesOf(
	payload: OtlpPayload,
): { traceId: string; sessionId: string; earliestTimestamp: string }[] {
	const traces = new Map<
		string,
		{ traceId: string; sessionId: string; earliestTimestamp: string }
	>();

	for (const span of flatten(payload)) {
		if (!span.traceId) continue;
		const start = String(span.startTimeUnixNano ?? "");
		const seen = traces.get(span.traceId);
		if (!seen) {
			traces.set(span.traceId, {
				traceId: span.traceId,
				sessionId: attr(span, "gen_ai.conversation.id") ?? "",
				earliestTimestamp: start,
			});
			continue;
		}
		if (compareNanos(start, seen.earliestTimestamp) < 0) seen.earliestTimestamp = start;
		if (!seen.sessionId) seen.sessionId = attr(span, "gen_ai.conversation.id") ?? "";
	}

	return [...traces.values()];
}

/** OTLP nests as `resourceSpans[].scopeSpans[].spans[]`; every level may be absent. */
function flatten(payload: OtlpPayload): OtlpSpan[] {
	const spans: OtlpSpan[] = [];
	for (const resource of payload.resourceSpans ?? []) {
		for (const scope of resource.scopeSpans ?? []) {
			spans.push(...(scope.spans ?? []));
		}
	}
	return spans;
}

function whyUnusable(span: OtlpSpan, context: OtlpMapContext): string | undefined {
	// Dedup is on (trace_id, span_id). A row missing either can never be collapsed, so it
	// would duplicate itself permanently the first time a collector retries.
	if (!span.traceId) return "span has no traceId";
	if (!span.spanId) return `span in trace ${span.traceId} has no spanId`;
	if (promptIdOf(span, context) === undefined) {
		return `span ${span.spanId} has no genum.prompt.id and the API key has no default prompt`;
	}
	return undefined;
}

function promptIdOf(span: OtlpSpan, context: OtlpMapContext): number | undefined {
	const attribute = attr(span, "genum.prompt.id");
	const parsed = attribute === undefined ? Number.NaN : Number(attribute);
	if (Number.isInteger(parsed)) return parsed;
	return context.defaultPromptId;
}

/**
 * The turn ordinal for each trace in the payload.
 *
 * The caller normally knows them already, having numbered the payload's traces against the
 * ones this session has stored. Without that map the payload's own traces are numbered
 * from zero by start time -- correct for a first delivery, and the only thing available.
 */
function turnIndices(spans: OtlpSpan[], context: OtlpMapContext): (traceId: string) => number {
	if (context.turnIndexByTrace) {
		const known = context.turnIndexByTrace;
		return (traceId) => known.get(traceId) ?? 0;
	}

	const earliest = new Map<string, string>();
	for (const span of spans) {
		const traceId = String(span.traceId);
		const start = String(span.startTimeUnixNano ?? "");
		const seen = earliest.get(traceId);
		if (seen === undefined || compareNanos(start, seen) < 0) earliest.set(traceId, start);
	}

	const ordered = [...earliest.entries()]
		// Trace id breaks a tie, so two deliveries of the same batch number it the same way.
		.sort(
			([aId, aStart], [bId, bStart]) =>
				compareNanos(aStart, bStart) || aId.localeCompare(bId),
		)
		.map(([traceId]) => traceId);

	return (traceId) => Math.max(ordered.indexOf(traceId), 0);
}

function groupByTrace(spans: OtlpSpan[]): Map<string, OtlpSpan[]> {
	const groups = new Map<string, OtlpSpan[]>();
	for (const span of spans) {
		const traceId = String(span.traceId);
		const group = groups.get(traceId);
		if (group) group.push(span);
		else groups.set(traceId, [span]);
	}
	return groups;
}

function byStartTime(a: OtlpSpan, b: OtlpSpan): number {
	return compareNanos(String(a.startTimeUnixNano ?? ""), String(b.startTimeUnixNano ?? ""));
}

function toClickHouseTime(nanos: string | number | undefined): string {
	// A span with no start time is stamped now rather than at the epoch: a 1970 row lands
	// in a partition of its own and reads as older than everything else, permanently.
	if (nanos === undefined || nanos === "") return formatClickHouseTimestamp(new Date());
	const millis = BigInt(nanos) / 1_000_000n;
	return formatClickHouseTimestamp(new Date(Number(millis)));
}

function durationOf(span: OtlpSpan): number {
	if (span.startTimeUnixNano === undefined || span.endTimeUnixNano === undefined) return 0;
	const millis = (BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano)) / 1_000_000n;
	return millis > 0n ? Number(millis) : 0;
}

function attr(span: OtlpSpan, key: string): string | undefined {
	const found = span.attributes?.find((attribute) => attribute.key === key);
	return found?.value === undefined ? undefined : scalar(found.value);
}

function intAttr(span: OtlpSpan, key: string): number {
	const value = Number(attr(span, key));
	return Number.isFinite(value) ? value : 0;
}

/** Attributes are `{key, value: {stringValue|intValue|...}}`, and an int64 is a string. */
function scalar(value: OtlpAnyValue): string | undefined {
	if (value.stringValue !== undefined) return value.stringValue;
	if (value.intValue !== undefined) return String(value.intValue);
	if (value.doubleValue !== undefined) return String(value.doubleValue);
	if (value.boolValue !== undefined) return String(value.boolValue);
	return undefined;
}

/**
 * The reply that provoked this turn: the last `user` entry of the chat span's
 * `gen_ai.input.messages`.
 *
 * The conventions put a human reply there rather than in a span of its own, so this is the
 * only place it exists. Both message shapes are read -- `{role, parts:[{content}]}` from
 * the current conventions and `{role, content}` from what most SDKs still emit.
 */
function lastUserMessage(spans: OtlpSpan[]): string | undefined {
	for (let index = spans.length - 1; index >= 0; index -= 1) {
		const raw = attr(spans[index], "gen_ai.input.messages");
		if (!raw) continue;

		let messages: unknown;
		try {
			messages = JSON.parse(raw);
			// A payload we cannot parse is not an error: the attribute is optional, and the
			// turn is worth storing without a reply. It replays NOK, which is visible.
		} catch {
			continue;
		}
		if (!Array.isArray(messages)) continue;

		for (let m = messages.length - 1; m >= 0; m -= 1) {
			const message = messages[m] as { role?: string; content?: unknown; parts?: unknown };
			if (message?.role !== "user") continue;
			const text = textOf(message);
			if (text) return text;
		}
	}
	return undefined;
}

function textOf(message: { content?: unknown; parts?: unknown }): string | undefined {
	if (typeof message.content === "string") return message.content;
	if (!Array.isArray(message.parts)) return undefined;
	const text = message.parts
		.map((part) => (part as { content?: unknown })?.content)
		.filter((content): content is string => typeof content === "string")
		.join("");
	return text || undefined;
}
