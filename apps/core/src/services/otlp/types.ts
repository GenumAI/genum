import type { SpanRow } from "@/services/logger/spans";

/**
 * The shape of an OTLP/HTTP JSON trace payload, narrowed to what the mapping reads.
 *
 * Deliberately not the full protocol types: every field here is one the mapping touches,
 * and a field nobody reads is a field nobody keeps correct. Everything is optional because
 * this arrives from a stranger's collector -- the mapping validates, the type does not.
 */
export type OtlpAnyValue = {
	stringValue?: string;
	/** An int64 in JSON, so it arrives as a STRING. A number here is the exception. */
	intValue?: string | number;
	boolValue?: boolean;
	doubleValue?: number;
	arrayValue?: { values?: OtlpAnyValue[] };
};

export type OtlpAttribute = { key?: string; value?: OtlpAnyValue };

export type OtlpSpan = {
	traceId?: string;
	spanId?: string;
	parentSpanId?: string;
	name?: string;
	/** Nanoseconds since the epoch, as a string for the same int64 reason. */
	startTimeUnixNano?: string | number;
	endTimeUnixNano?: string | number;
	attributes?: OtlpAttribute[];
	status?: { code?: number | string; message?: string };
};

export type OtlpPayload = {
	resourceSpans?: {
		resource?: { attributes?: OtlpAttribute[] };
		scopeSpans?: { spans?: OtlpSpan[] }[];
	}[];
};

export type OtlpMapContext = {
	orgId: number;
	projectId: number;
	/** The API key's prompt, used for any span without `genum.prompt.id`. */
	defaultPromptId?: number;
	/**
	 * The turn ordinal each trace holds in its session, when the caller already knows it
	 * (`assignTurnIndices` against the traces already stored). Without it the mapping
	 * numbers the payload's own traces from zero, which is right for a first delivery and
	 * wrong for a later one -- and being wrong about it is not cosmetic: a turn that is not
	 * the first is where a human reply gets derived from (S2), so a trace delivered on its
	 * own would otherwise lose the reply that provoked it.
	 */
	turnIndexByTrace?: ReadonlyMap<string, number>;
};

export type OtlpMapResult = {
	rows: SpanRow[];
	/** Spans that could not be stored. The batch still succeeds; OTLP calls this partial. */
	rejected: number;
	reasons: string[];
};
