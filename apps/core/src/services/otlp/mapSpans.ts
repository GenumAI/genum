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
		const sessionId = sessionIdOf(ordered);

		// The human reply that provoked this turn, from the chat span's input messages
		// (S2). It goes first: everything else in the turn happened because of it.
		//
		// Decided from the messages THEMSELVES, not from the turn ordinal. A turn's input
		// opens with the session's original question, so a turn carrying a second user
		// entry was provoked by the last of them, and a turn carrying only one is the
		// opening turn -- whatever ordinal it happens to have been given.
		//
		// Keyed on the ordinal, as it was, two deliveries could disagree: a turn arriving
		// before the turn that preceded it (a retry after a collector restart) took ordinal
		// 0 and lost its reply, while the earlier turn arriving second was given a spurious
		// `user reply` holding the session's opening question -- exactly what S2 says must
		// never become a step. Append-only, so neither was correctable.
		const reply = replyIn(ordered);
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
	// NOT defaulted to "chat". A span that never said what operation it is has not told us
	// it produced an answer, and calling it a chat made `spansToSteps` pin it as the turn's
	// expected answer -- so a session from an instrumentation that labels only some of its
	// spans acquired expected answers it never produced. Stored empty, it is still shown;
	// it simply is not a step.
	const operation = attr(span, "gen_ai.operation.name") ?? "";
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
		// `gen_ai.tool.name` first: it is where the conventions put a tool's name, and it
		// is the only place the name is unambiguous. The span name is a fallback because
		// most SDKs write `execute_tool <name>` there and the reader strips that prefix --
		// which quietly produces a tool named after the whole span for any sender that
		// names its spans differently.
		name: toolName(span, operation) ?? span.name ?? operation,
		input: attr(span, "gen_ai.input.messages") ?? "",
		// The answer as TEXT, not as the envelope it travelled in. `spansToSteps` makes this
		// column the text of a `final` step, so an envelope stored verbatim becomes the
		// expected answer of any testcase pinned from this session -- and no replay can ever
		// produce a JSON array of message objects, making every ingested regression test
		// fail by construction.
		output: answerText(attr(span, "gen_ai.output.messages")),
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
				sessionId: sessionIdOf([span]),
				earliestTimestamp: start,
			});
			continue;
		}
		if (compareNanos(start, seen.earliestTimestamp) < 0) seen.earliestTimestamp = start;
		if (!seen.sessionId) seen.sessionId = sessionIdOf([span]);
	}

	return [...traces.values()];
}

/**
 * The session a trace belongs to: the first `gen_ai.conversation.id` any of its spans
 * carries, or empty for a trace that is a session by itself.
 *
 * ONE resolver, used by both passes, because they must agree permanently. They did not:
 * the numbering pass scanned every span while the mapping read only the earliest, so a
 * trace whose tool span started before its chat span was numbered against a session it was
 * then stored OUTSIDE of -- invisible in that session's read, and holding an ordinal the
 * next batch would hand to a different trace. `trace_spans` is append-only, so neither is
 * correctable afterwards.
 *
 * Scanning rather than reading one span is the correct half of that pair: an instrumented
 * agent routinely emits its tool spans from a different layer, which does not stamp the
 * conversation id.
 */
function sessionIdOf(spans: OtlpSpan[]): string {
	for (const span of spans) {
		const sessionId = attr(span, "gen_ai.conversation.id");
		if (sessionId) return sessionId;
	}
	return "";
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
		// Names the attribute and says which of the two things went wrong. This message is
		// the whole of what a customer sees when their collector is misconfigured, and the
		// fix is one line at their end -- if we say which line. It no longer mentions a
		// default prompt on the API key: there is no such column, and pointing someone at
		// a feature that does not exist costs them an afternoon.
		return attr(span, "genum.prompt.id") === undefined
			? `span ${span.spanId} has no genum.prompt.id attribute`
			: `span ${span.spanId} has a genum.prompt.id that is not a valid prompt id`;
	}
	return undefined;
}

/**
 * Every id and counter that reaches ClickHouse is a `UInt32`, and the insert does not
 * negotiate: a value above the range WRAPS silently (5000000000 is stored as 705032704 --
 * verified against the server), and a negative one fails the whole insert.
 *
 * Both are worse than they look. A wrapped id puts a customer's spans on a different
 * prompt's page, in a table that cannot be corrected. A failed insert becomes a 503, and a
 * collector retries a failed batch WHOLE, so a single malformed attribute blocks that
 * session's ingest for as long as the collector keeps trying -- bypassing the
 * partial-success path that exists so one bad span cannot take a good batch down.
 */
const UINT32_MAX = 4294967295;

function isStorableId(value: number): boolean {
	return Number.isInteger(value) && value > 0 && value <= UINT32_MAX;
}

function promptIdOf(span: OtlpSpan, context: OtlpMapContext): number | undefined {
	const attribute = attr(span, "genum.prompt.id");
	if (attribute !== undefined) {
		const parsed = Number(attribute);
		// A value that is present but unusable is REFUSED, never silently replaced by the
		// default: the sender said which prompt they meant, and quietly filing their traces
		// under a different one is the failure this whole path is built to avoid.
		return isStorableId(parsed) ? parsed : undefined;
	}
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

/**
 * A span's start, as the literal `DateTime64(3)` accepts.
 *
 * Everything unusable falls back to now, and none of it refuses the span. `BigInt` throws
 * a `SyntaxError` on anything that is not an integer literal -- `"1757…000.0"` from an
 * exporter that formatted a float, an ISO string from a hand-rolled one -- and uncaught it
 * escaped as a 500 carrying the raw error text, with the collector retrying the same batch
 * forever. A value beyond the `Date` range formats as "Invalid date", which ClickHouse
 * rejects, failing the whole insert for one span's bad clock.
 *
 * Now rather than the epoch: a 1970 row lands in a partition of its own and reads as older
 * than everything else, permanently, in a table that cannot be corrected.
 */
function toClickHouseTime(nanos: string | number | undefined): string {
	return formatClickHouseTimestamp(instantOf(nanos) ?? new Date());
}

function instantOf(nanos: string | number | undefined): Date | undefined {
	if (nanos === undefined || nanos === "") return undefined;

	let millis: bigint;
	try {
		millis = BigInt(nanos) / 1_000_000n;
	} catch {
		return undefined;
	}

	const instant = new Date(Number(millis));
	return Number.isNaN(instant.getTime()) ? undefined : instant;
}

function durationOf(span: OtlpSpan): number {
	const start = instantOf(span.startTimeUnixNano);
	const end = instantOf(span.endTimeUnixNano);
	if (!start || !end) return 0;

	const millis = end.getTime() - start.getTime();
	// A negative duration is a clock that moved backwards, not a measurement.
	return millis > 0 ? millis : 0;
}

function attr(span: OtlpSpan, key: string): string | undefined {
	const found = span.attributes?.find((attribute) => attribute.key === key);
	return found?.value === undefined ? undefined : scalar(found.value);
}

function intAttr(span: OtlpSpan, key: string): number {
	const value = Number(attr(span, key));
	// Usage counts are display-only, so a nonsensical one is worth ignoring rather than
	// refusing the span that carried it -- but a negative or oversized value must never
	// reach the UInt32 insert, which would fail the batch and put the collector in a
	// retry loop over a number nobody reads.
	if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) return 0;
	return value;
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
function replyIn(spans: OtlpSpan[]): string | undefined {
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

		const userTexts = messages
			.filter((message) => (message as { role?: string })?.role === "user")
			.map((message) => textOf(message as { content?: unknown; parts?: unknown }))
			.filter((text): text is string => Boolean(text));

		// One user message is the session's opening question -- the testcase's `input`,
		// never a step. Two or more means this turn was provoked by the last of them.
		if (userTexts.length > 1) return userTexts[userTexts.length - 1];
	}
	return undefined;
}

/**
 * A tool span's name, spelled the way the reader on the other side expects it.
 *
 * `spansToSteps` takes the stored `name`, strips a leading `execute_tool `, and calls the
 * rest the tool's name. That is right for the span names most SDKs write and wrong for
 * everything else -- a sender naming its span `weather lookup` produced a step asserting a
 * tool literally called "weather lookup". `gen_ai.tool.name` is the attribute the
 * conventions define for this, so it wins, and it is re-prefixed so the stored value stays
 * one shape rather than two.
 */
function toolName(span: OtlpSpan, operation: string): string | undefined {
	if (operation !== "execute_tool") return undefined;
	const name = attr(span, "gen_ai.tool.name");
	return name ? `execute_tool ${name}` : undefined;
}

/**
 * The question a session opened with: the FIRST `user` entry of a chat span's
 * `gen_ai.input.messages`.
 *
 * The opening question is not a step and never gets a span of its own -- `replyIn` reads
 * the LAST user entry, which is the reply that provoked this turn, and deliberately
 * ignores the first because turn 0 has no reply. So without this the question a session
 * started from was stored nowhere usable, and a testcase pinned from that session got an
 * empty input: a recorded conversation that cannot be replayed, because the thing that
 * started it is missing.
 *
 * Read from any turn, not only turn 0. A turn's input messages carry the history as
 * sent, so the first user entry of turn 3 is still the question the session opened with
 * -- which means a session can be pinned from any of its turns without going back to
 * fetch turn 0.
 *
 * Both message shapes are read, the same two `replyIn` handles.
 */
export function openingQuestion(raw: string | undefined): string {
	if (!raw) return "";

	let messages: unknown;
	try {
		messages = JSON.parse(raw);
		// Unparseable is not an error here for the same reason it is not in `replyIn`:
		// the attribute is optional, and the turn is worth storing without it.
	} catch {
		return "";
	}
	if (!Array.isArray(messages)) return "";

	for (const message of messages) {
		if ((message as { role?: string })?.role !== "user") continue;
		const text = textOf(message as { content?: unknown; parts?: unknown });
		if (text) return text;
	}

	return "";
}

/**
 * The model's answer, out of `gen_ai.output.messages`.
 *
 * The conventions carry it as a message array, in the same two shapes the input side
 * arrives in. A sender that puts a bare string there is not conforming, but the answer is
 * the one field worth keeping even when the envelope is unrecognisable -- so anything
 * unparseable is returned as it came rather than dropped.
 */
function answerText(raw: string | undefined): string {
	if (!raw) return "";

	let messages: unknown;
	try {
		messages = JSON.parse(raw);
	} catch {
		return raw;
	}
	if (!Array.isArray(messages)) return raw;

	const texts = messages
		.map((message) => textOf(message as { content?: unknown; parts?: unknown }))
		.filter((text): text is string => Boolean(text));

	// Joined rather than "the last one": a model that answers in several parts wrote one
	// answer, and keeping only its final fragment would silently truncate it.
	return texts.length > 0 ? texts.join("\n") : raw;
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
