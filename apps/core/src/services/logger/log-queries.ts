/**
 * Reads of individual `logs` rows: the paged lists on the prompt and project logs pages,
 * and the payload of one row for the details dialog.
 */

import moment from "moment";
import { CLICKHOUSE_TABLES, clickhouseClient } from "./client";
import {
	formatClickHouseTimestamp,
	parseClickHouseTimestamp,
	resolveLogPlaceholders,
} from "./mappers";
import { QUERIES, QUOTE_64BIT_INTEGERS } from "./queries";
import { buildWhereConditions, WhereBuilder, type QueryParams } from "./where.builder";
import type {
	LogListEntry,
	LogDetail,
	LogSearchResult,
	ProjectLogsFilter,
	ClickHouseLogListRow,
	ClickHouseLogDetailRow,
	ClickHouseCountRow,
	SourceType,
	LogLevel,
	LogType,
} from "./types";

// Helper function to transform a ClickHouse list row to a LogListEntry
function transformRowToLogListEntry(row: ClickHouseLogListRow): LogListEntry {
	return {
		log_id: String(row.log_id),
		timestamp: parseClickHouseTimestamp(row.timestamp),
		source: row.source as SourceType,
		log_lvl: row.log_lvl as LogLevel,
		log_type: row.log_type as LogType,
		description: row.description || undefined,
		orgId: row.orgId,
		project_id: row.project_id,
		prompt_id: row.prompt_id,
		user_id: row.user_id || undefined,
		api_key_id: row.api_key_id || undefined,
		testcase_id: row.testcase_id || undefined,
		trace_id: row.trace_id || undefined,
		vendor: row.vendor,
		model: row.model,
		tokens_in: row.tokens_in,
		tokens_out: row.tokens_out,
		tokens_sum: row.tokens_sum,
		cost: row.cost,
		response_ms: row.response_ms,
		tokens_in_cache_read: row.tokens_in_cache_read,
		tokens_in_cache_write: row.tokens_in_cache_write,
		tokens_out_reasoning: row.tokens_out_reasoning,
		cost_in_cache_read: row.cost_in_cache_read,
		cost_in_cache_write: row.cost_in_cache_write,
		cost_out_reasoning: row.cost_out_reasoning,
	};
}

/**
 * One page of a log list and the total behind it, for whatever filter the caller built.
 * Rejects with ClickHouse's error as is: each caller reports it under its own message.
 */
async function queryLogPage(
	where: string,
	params: QueryParams["params"],
	page: number,
	pageSize: number,
): Promise<LogSearchResult> {
	const offset = (page - 1) * pageSize;
	const queryParams = { ...params, limit: pageSize, offset };

	// Get total count
	const countResult = await clickhouseClient.query({
		query: QUERIES.COUNT(CLICKHOUSE_TABLES.LOGS, where),
		query_params: params,
		format: "JSONEachRow",
	});

	const countData = (await countResult.json()) as ClickHouseCountRow[];
	const total = countData[0]?.total || 0;

	// Get logs with pagination
	const logsResult = await clickhouseClient.query({
		query: QUERIES.GET_LOGS(CLICKHOUSE_TABLES.LOGS, where),
		query_params: queryParams,
		clickhouse_settings: QUOTE_64BIT_INTEGERS,
		format: "JSONEachRow",
	});

	const logsData = (await logsResult.json()) as ClickHouseLogListRow[];
	const logs = logsData.map(transformRowToLogListEntry);

	return {
		logs,
		total: Number(total),
		page,
		pageSize,
	};
}

/**
 * `projectId` is not optional context -- it completes the sorting key.
 *
 * The key is (orgId, project_id, timestamp). With `project_id` left free this filter stops
 * at `orgId`, so `ORDER BY timestamp DESC LIMIT 10` cannot read in key order: ClickHouse
 * reads every row the organisation logged in the window and sorts them to return ten. With
 * it pinned, the same page reads 8k rows instead of 480k on a 3M-row table.
 *
 * Safe because a log row's `project_id` is always the prompt's project: the API run path
 * rejects `prompt.projectId !== project.id` outright, the UI path goes through
 * `checkPromptAccess`, and `PromptUpdateSchema` cannot move a prompt between projects.
 */
export async function getPromptLogs(
	orgId: number,
	projectId: number,
	promptId: number,
	page: number = 1,
	pageSize: number = 10,
	fromDate?: Date,
	toDate?: Date,
	source?: SourceType,
	logLevel?: LogLevel,
	query?: string,
): Promise<LogSearchResult> {
	const from = fromDate ?? moment().subtract(30, "days").toDate();
	const to = toDate ?? new Date();

	try {
		const { where, params } = buildWhereConditions(
			orgId,
			projectId,
			promptId,
			from,
			to,
			source,
			logLevel,
			undefined,
			query,
		);

		return await queryLogPage(where, params, page, pageSize);
	} catch (error) {
		console.error("Error getting logs from ClickHouse:", error);
		throw error;
	}
}

/**
 * The payload of one log row, for the details dialog.
 *
 * `orgId` and `projectId` are the caller's, never the client's. `projectId` is always
 * passed -- it is both the access boundary on the project logs page and, on either page,
 * the middle of the sorting key (orgId, project_id, timestamp), so pinning it lets the
 * exact `timestamp` narrow to a granule rather than a whole partition. A prompt's rows
 * cannot carry another project's id: the API run path rejects
 * `prompt.projectId !== project.id`, the UI path goes through `checkPromptAccess`, and
 * `PromptUpdateSchema` cannot move a prompt between projects.
 *
 * Returns `null` for a row that is not there rather than throwing -- a log outside the
 * retention window is a 404, not a fault.
 */
export async function getLogDetail(params: {
	orgId: number;
	projectId: number;
	logId: string;
	timestamp: Date;
	promptId?: number;
}): Promise<LogDetail | null> {
	try {
		const builder = WhereBuilder.forOrg(params.orgId).projectId(params.projectId);

		if (params.promptId !== undefined) {
			builder.promptId(params.promptId);
		}

		builder.timestampExact(formatClickHouseTimestamp(params.timestamp)).logId(params.logId);

		const { where, params: queryParams } = builder.build();

		const result = await clickhouseClient.query({
			query: QUERIES.GET_LOG_DETAIL(CLICKHOUSE_TABLES.LOGS, where),
			query_params: queryParams,
			clickhouse_settings: QUOTE_64BIT_INTEGERS,
			format: "JSONEachRow",
		});

		const rows = (await result.json()) as ClickHouseLogDetailRow[];
		const row = rows[0];
		if (!row) {
			return null;
		}

		return {
			log_id: String(row.log_id),
			in: row.in,
			out: row.out,
			placeholders: resolveLogPlaceholders(row),
		};
	} catch (error) {
		console.error("Error getting log detail from ClickHouse:", error);
		throw error;
	}
}

export async function getProjectLogs(
	orgId: number,
	projectId: number,
	page: number = 1,
	pageSize: number = 10,
	filters?: ProjectLogsFilter,
): Promise<LogSearchResult> {
	const from = filters?.fromDate ?? moment().subtract(30, "days").toDate();
	const to = filters?.toDate ?? new Date();

	try {
		const { where, params } = buildWhereConditions(
			orgId,
			projectId,
			filters?.promptId,
			from,
			to,
			filters?.source,
			filters?.logLevel,
			undefined,
			filters?.query,
		);

		return await queryLogPage(where, params, page, pageSize);
	} catch (error) {
		console.error("Error getting project logs from ClickHouse:", error);
		throw error;
	}
}
