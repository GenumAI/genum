/**
 * Writes: one `logs` row per run, and the `trace_spans` rows of its steps.
 */

import { env } from "@/env";
import { captureSentryException } from "@/services/sentry/init";
import { CLICKHOUSE_TABLES, clickhouseClient } from "./client";
import { formatClickHouseTimestamp } from "./mappers";
import { toSpanRows, type SpanBatch, type SpanRow } from "./spans";
import type { LogDocument } from "./types";

/**
 * Records one run. Never rejects.
 *
 * Every caller writes this row AFTER the run it describes has already happened -- and, on
 * the success path in `runPrompt`, after the organisation's quota has already been charged
 * for it. Rethrowing turned an answer the user had paid for into a 500 whenever ClickHouse
 * was down, slow, or rejected the row, so a failed insert is reported and dropped instead:
 * losing an analytics row is recoverable, charging for an answer we then refuse to hand
 * over is not.
 */
export async function logUsage(document: LogDocument): Promise<void> {
	const timestamp = document.timestamp ?? new Date();

	try {
		// UTC, matching `parseClickHouseTimestamp` on the way back out: the column carries
		// no zone, so writing in the process timezone and reading in UTC would shift every
		// row by the offset on any server that is not itself UTC.
		const timestampStr = formatClickHouseTimestamp(timestamp);

		await clickhouseClient.insert({
			table: CLICKHOUSE_TABLES.LOGS,
			values: [
				{
					timestamp: timestampStr,
					source: document.source,
					log_lvl: document.log_lvl,
					log_type: document.log_type,
					description: document.description || null,
					orgId: document.orgId,
					project_id: document.project_id,
					prompt_id: document.prompt_id,
					user_id: document.user_id || null,
					api_key_id: document.api_key_id || null,
					testcase_id: document.testcase_id || null,
					trace_id: document.trace_id ?? null,
					vendor: document.vendor,
					model: document.model,
					tokens_in: document.tokens_in,
					tokens_out: document.tokens_out,
					tokens_sum: document.tokens_sum,
					cost: document.cost,
					response_ms: document.response_ms,
					tokens_in_cache_read: document.tokens_in_cache_read,
					tokens_in_cache_write: document.tokens_in_cache_write,
					tokens_out_reasoning: document.tokens_out_reasoning,
					cost_in_cache_read: document.cost_in_cache_read,
					cost_in_cache_write: document.cost_in_cache_write,
					cost_out_reasoning: document.cost_out_reasoning,
					in: document.in,
					out: document.out,
					// Frozen: readable for rows written before `placeholders` existed, never
					// written again — see clickhouse/migrations/.
					memory_key: null,
					placeholders: document.placeholders ?? {},
					stage: env.NODE_ENV,
				},
			],
			format: "JSONEachRow",
		});
	} catch (error) {
		console.error("Ошибка записи лога в ClickHouse:", error);
		captureSentryException(error, { error_type: "clickhouse_log_write" });
	}
}

/**
 * Writes the steps of an agentic run. The root of the trace is the `logs` row written by
 * `logUsage`; this call adds its tool_call/final steps as rows in `trace_spans`.
 *
 * Deliberately diverges from `logUsage`, which propagates its insert error: by the time
 * this runs, the run's `logs` row is already written and the run itself succeeded. Spans
 * are supplementary detail -- letting a failed span insert throw away an otherwise
 * successful run would be strictly worse than just not having the spans. Do not "fix" this
 * back into consistency with `logUsage`.
 */
export async function logSpans(batch: SpanBatch): Promise<void> {
	const rows = toSpanRows(batch);
	if (rows.length === 0) {
		return;
	}

	try {
		await insertSpanRows(rows);
	} catch (error) {
		console.error("Ошибка записи span-ов в ClickHouse:", error);
	}
}

/**
 * Writes already-mapped span rows, and PROPAGATES a failure -- the opposite of `logSpans`
 * above, on purpose.
 *
 * For our own runs a failed span insert is supplementary detail lost after the run already
 * succeeded, so swallowing it is right. For ingest the spans ARE the request: a collector
 * that receives 200 for a batch we did not store never sends it again, and the trace is
 * gone. It must see the failure and retry, which read-side dedup makes safe.
 */
export async function insertSpanRows(rows: SpanRow[]): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	await clickhouseClient.insert({
		table: CLICKHOUSE_TABLES.TRACE_SPANS,
		values: rows,
		format: "JSONEachRow",
	});
}
