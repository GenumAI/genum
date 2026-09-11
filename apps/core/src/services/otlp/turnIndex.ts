export type ArrivingTrace = {
	traceId: string;
	/** The trace's earliest span start, in nanoseconds, as OTLP sends it. */
	earliestTimestamp: string;
};

/**
 * The turn ordinal each arriving trace holds in its session (S5).
 *
 * A trace already stored keeps the place it has -- `alreadyStored` is the session's trace
 * ids in turn order, so a trace's index in it IS its `turn_index`. Traces new to the
 * session take the ordinals after them, ordered among themselves by earliest span
 * timestamp with the trace id as a stable tie-break.
 *
 * This is the least reversible decision in the ingest: `turn_index` goes into an
 * append-only table and can never be renumbered. Two consequences follow, and both are
 * pinned by tests. A redelivery must number a batch exactly as the first delivery did, or
 * the same turn is stored twice under two ordinals and dedup -- which keys on
 * `(trace_id, span_id)` -- cannot see them as the same row. And a turn delivered late,
 * after a later turn has already arrived, is appended rather than inserted in its true
 * place: the session then reads in the wrong order. Timestamps are stored, so a read-side
 * reordering stays possible without touching a row, which is the remedy if real senders
 * turn out to deliver out of order.
 */
export function assignTurnIndices(
	traces: ArrivingTrace[],
	alreadyStored: string[],
): Map<string, number> {
	const stored = new Map(alreadyStored.map((traceId, index) => [traceId, index]));
	const indices = new Map<string, number>();

	const fresh = traces.filter((trace) => !stored.has(trace.traceId));
	fresh.sort(
		(a, b) =>
			compareNanos(a.earliestTimestamp, b.earliestTimestamp) ||
			a.traceId.localeCompare(b.traceId),
	);

	for (const trace of traces) {
		const known = stored.get(trace.traceId);
		if (known !== undefined) {
			indices.set(trace.traceId, known);
			continue;
		}
		indices.set(trace.traceId, alreadyStored.length + fresh.indexOf(trace));
	}

	return sortedByIndex(indices);
}

/** Iteration order follows the turn order, so a caller can read the map as a sequence. */
function sortedByIndex(indices: Map<string, number>): Map<string, number> {
	return new Map([...indices].sort(([, a], [, b]) => a - b));
}

/**
 * Nanosecond instants compared as integers without ever becoming a `number`: 1.75e18 is
 * past `Number.MAX_SAFE_INTEGER`, so two turns a millisecond apart would round to the same
 * instant and the tie-break would decide the conversation's order instead of time. An
 * empty instant sorts last -- a trace that told us nothing about when it happened cannot
 * be placed ahead of one that did.
 */
export function compareNanos(a: string, b: string): number {
	if (a === b) return 0;
	if (!a) return 1;
	if (!b) return -1;
	if (a.length !== b.length) return a.length - b.length;
	return a < b ? -1 : 1;
}
