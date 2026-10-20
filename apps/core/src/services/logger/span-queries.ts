/**
 * Reads of the `trace_spans` table: the recorded steps of a session, and the traces it
 * already holds.
 */

import { CLICKHOUSE_TABLES, clickhouseClient } from "./client";
import { QUERIES } from "./queries";
import type { SpanRow } from "./spans";
import type { ClickHouseSpanRow } from "./types";
import { WhereBuilder } from "./where.builder";

/**
 * A session spans every turn of a conversation, so its span count is unbounded even
 * though each turn's steps are capped and each turn is its own trace. Far more than this
 * is a runaway session, not a session anyone is going to read.
 */
const MAX_TRACE_SPANS = 1000;

/**
 * Reads the spans of one session across all its turns, ordered by `turn_index` and then
 * `span_index`. Scoped by org and project the same way every other logger query is -- a
 * session_id from another org's run never matches.
 */
export async function getSessionSpans(
	sessionId: string,
	orgId: number,
	projectId: number,
): Promise<SpanRow[]> {
	try {
		const { where, params } = WhereBuilder.forOrg(orgId).projectId(projectId).build();

		const result = await clickhouseClient.query({
			query: QUERIES.GET_SPANS(CLICKHOUSE_TABLES.TRACE_SPANS, where),
			query_params: { ...params, session: sessionId, limit: MAX_TRACE_SPANS },
			format: "JSONEachRow",
		});

		const data = (await result.json()) as ClickHouseSpanRow[];

		return data.map((row) => ({
			timestamp: row.timestamp,
			trace_id: row.trace_id,
			session_id: row.session_id,
			turn_index: Number(row.turn_index),
			span_id: row.span_id,
			parent_span_id: row.parent_span_id,
			span_index: Number(row.span_index),
			span_type: row.span_type as SpanRow["span_type"],
			orgId: Number(row.orgId),
			project_id: Number(row.project_id),
			prompt_id: Number(row.prompt_id),
			name: row.name,
			input: row.input,
			output: row.output,
			tool_args: row.tool_args,
			tool_result: row.tool_result,
			tool_error: row.tool_error,
			vendor: row.vendor,
			model: row.model,
			tokens_in: Number(row.tokens_in),
			tokens_out: Number(row.tokens_out),
			cost: Number(row.cost),
			duration_ms: Number(row.duration_ms),
			status: row.status,
			// A row written before the column existed reads back as `genum`, which is what
			// it is: everything predating OTLP ingest is our own run.
			source: (row.source ?? "genum") as SpanRow["source"],
			// Empty means the turn never recorded what it ran with, which is the only
			// honest reading of a row written before these columns existed. Every consumer
			// treats empty as "use what you would have used anyway" rather than as an
			// instruction to run with nothing.
			placeholders: row.placeholders ?? {},
			tools_offered: row.tools_offered ?? [],
			prompt_version: row.prompt_version ?? "",
		}));
	} catch (error) {
		console.error("Error getting trace spans from ClickHouse:", error);
		throw error;
	}
}

/**
 * The trace ids already stored for a session, in turn order.
 *
 * Read by OTLP ingest before it writes, so a trace new to the session takes the ordinal
 * after these and a redelivered one keeps the place it has. Scoped by org and project like
 * every other logger read: a conversation id from another org's traffic never matches.
 *
 * Unbounded on purpose -- one short string per turn, and a cap here would silently
 * renumber every turn past it, in a table where `turn_index` cannot be corrected.
 */
export async function getSessionTraceIds(
	sessionId: string,
	orgId: number,
	projectId: number,
): Promise<string[]> {
	try {
		const { where, params } = WhereBuilder.forOrg(orgId).projectId(projectId).build();

		const result = await clickhouseClient.query({
			query: QUERIES.GET_SESSION_TRACE_IDS(CLICKHOUSE_TABLES.TRACE_SPANS, where),
			query_params: { ...params, session: sessionId },
			format: "JSONEachRow",
		});

		const data = (await result.json()) as { trace_id: string }[];

		return data.map((row) => row.trace_id);
	} catch (error) {
		console.error("Error getting session trace ids from ClickHouse:", error);
		throw error;
	}
}
