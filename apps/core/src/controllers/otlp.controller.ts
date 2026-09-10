import type { Request, Response } from "express";

import { resolveApiKey } from "@/auth/apiKey";
import {
	getSessionTraceIds,
	insertSpanRows,
	LogLevel,
	LogType,
	logUsage,
	SourceType,
} from "@/services/logger";
import type { SpanRow } from "@/services/logger";
import { mapOtlpSpans, tracesOf } from "@/services/otlp/mapSpans";
import { assignTurnIndices } from "@/services/otlp/turnIndex";
import type { OtlpPayload } from "@/services/otlp/types";
import { HttpError } from "@/utils/errors";

/**
 * OTLP/HTTP JSON trace ingest: a customer's own OpenTelemetry traces become sessions here.
 *
 * Thin by design. Authentication is `@/auth/apiKey` (the same code `/api/v1` uses), the
 * mapping is `mapOtlpSpans`, the ordering is `assignTurnIndices`, and all three are pure
 * and tested on their own. What is decided here and nowhere else is the HTTP contract:
 * which failures are the batch's fault, and which are ours.
 */
export class OtlpController {
	/**
	 * `POST /api/public/otel/v1/traces`.
	 *
	 * Answers OTLP's shape, which is not the obvious one. Spans that could not be stored
	 * come back as a `partialSuccess` count on a 200, not as an error: a collector retries
	 * a failed batch WHOLE, so failing the batch over one bad span resends every good span
	 * with it. A 4xx is kept for a batch with nothing storable in it at all, where a retry
	 * would be equally pointless -- and a 5xx for a write that failed on our side, where a
	 * retry is exactly what we want.
	 */
	public async ingestTraces(req: Request, res: Response): Promise<void> {
		const { project } = await resolveApiKey(req.headers.authorization);

		const payload = req.body as OtlpPayload;
		if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
			throw new HttpError(400, "Expected an OTLP/HTTP JSON body with `resourceSpans`");
		}

		const { turnIndexByTrace, known } = await this.numberTurns(
			payload,
			project.organizationId,
			project.id,
		);

		const { rows, rejected, reasons } = mapOtlpSpans(payload, {
			orgId: project.organizationId,
			projectId: project.id,
			turnIndexByTrace,
		});

		if (rows.length === 0 && rejected > 0) {
			// Nothing landed, so there is nothing a partial success would describe. The
			// reasons go back in full: the usual cause is a sender that has not set
			// `genum.prompt.id`, and a message that does not name the attribute leaves them
			// guessing at a one-line fix.
			throw new HttpError(400, `No span could be stored. ${reasons.join("; ")}`);
		}

		await this.write(rows);
		// Only traces the session did not already hold. A redelivery writes the same spans
		// again (harmless -- the read collapses them on `(trace_id, span_id)`), but `logs`
		// has no such collapse, so announcing one twice would put a second, identical entry
		// in the logs list for a conversation the author already has.
		await this.announce(rows, known);

		res.status(200).json(
			rejected === 0
				? { partialSuccess: {} }
				: {
						partialSuccess: {
							// An int64 in the protocol, so a string in JSON.
							rejectedSpans: String(rejected),
							errorMessage: reasons.join("; "),
						},
					},
		);
	}

	/**
	 * The turn ordinal for every trace in the payload, read against what each session
	 * already holds.
	 *
	 * One read per distinct session, not per trace -- a batch is usually one conversation.
	 * A trace with no `gen_ai.conversation.id` is a session of one and takes turn 0
	 * without a read at all: the conventions forbid inventing a conversation id, so there
	 * is nothing to look it up by.
	 */
	private async numberTurns(
		payload: OtlpPayload,
		orgId: number,
		projectId: number,
	): Promise<{ turnIndexByTrace: Map<string, number>; known: Set<string> }> {
		const traces = tracesOf(payload);
		const indices = new Map<string, number>();
		// Traces this session already holds, so the caller can tell a redelivery from a new
		// turn without a second read.
		const known = new Set<string>();

		const sessions = new Map<string, typeof traces>();
		for (const trace of traces) {
			if (!trace.sessionId) {
				indices.set(trace.traceId, 0);
				continue;
			}
			const group = sessions.get(trace.sessionId);
			if (group) group.push(trace);
			else sessions.set(trace.sessionId, [trace]);
		}

		for (const [sessionId, group] of sessions) {
			const stored = await getSessionTraceIds(sessionId, orgId, projectId);
			for (const traceId of stored) known.add(traceId);
			for (const [traceId, index] of assignTurnIndices(group, stored)) {
				indices.set(traceId, index);
			}
		}

		return { turnIndexByTrace: indices, known };
	}

	/**
	 * One `logs` row per ingested trace, so the session can be OPENED.
	 *
	 * The logs list is the only entry point to a trajectory in the UI: spans with no row
	 * here are stored correctly and unreachable, and `trace_spans` is append-only, so a
	 * row not written now cannot be added later for traces already ingested.
	 *
	 * Two details are load-bearing. `trace_id` carries the SESSION, not the turn's own
	 * trace, because that is the key the spans read is scoped on -- a row carrying the turn
	 * id would open an empty session for any sender who supplied a conversation id. And
	 * every usage column is zero: the sender's token counts live on the spans, where they
	 * are shown per step, while summing them here would mix a customer's own traffic into
	 * our billing totals. Zeros keep every `sum()` in `queries.ts` correct without adding
	 * an exclusion to each of them.
	 *
	 * Failure is swallowed like `logUsage`'s own: the spans are already stored and the
	 * batch already succeeded, so throwing here would make a collector resend traces we
	 * hold. The cost is a session that is hard to find, not one that is lost.
	 */
	private async announce(rows: SpanRow[], known: Set<string>): Promise<void> {
		const seen = new Set<string>(known);

		for (const row of rows) {
			if (seen.has(row.trace_id)) continue;
			seen.add(row.trace_id);

			await logUsage({
				source: SourceType.otlp,
				log_lvl: LogLevel.success,
				log_type: LogType.TraceIngested,
				description: `Ingested trace ${row.trace_id}`,
				orgId: row.orgId,
				project_id: row.project_id,
				prompt_id: row.prompt_id,
				trace_id: row.session_id || row.trace_id,
				vendor: row.vendor,
				model: row.model,
				tokens_in: 0,
				tokens_out: 0,
				tokens_sum: 0,
				cost: 0,
				response_ms: 0,
				in: "",
				out: "",
			});
		}
	}

	private async write(rows: SpanRow[]): Promise<void> {
		if (rows.length === 0) return;
		try {
			await insertSpanRows(rows);
		} catch (error) {
			console.error("Error ingesting OTLP spans into ClickHouse:", error);
			// 5xx rather than a swallowed failure: a collector that gets 200 for a batch we
			// did not store never sends it again. Retrying is safe -- the read deduplicates
			// on `(trace_id, span_id)`, and every id here is stable across deliveries.
			throw new HttpError(503, "Could not store the spans. Retry the batch.");
		}
	}
}
