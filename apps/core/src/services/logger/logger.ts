/**
 * Logger Service for ClickHouse
 *
 * This service handles logging of AI usage data to ClickHouse.
 * Migrated from Elasticsearch for better performance and cost efficiency.
 *
 * Table Structure:
 * - Tables: usage_prod (production), usage_dev (development/integration)
 * - Partitioned by month (toYYYYMM(timestamp))
 * - Ordered by (orgId, project_id, timestamp)
 */

import { createClient } from "@clickhouse/client";
import moment from "moment";
import { env } from "@/env";
import { captureSentryException } from "@/services/sentry/init";
import { WhereBuilder } from "./where.builder";
import { QUERIES, QUOTE_64BIT_INTEGERS } from "./queries";
import {
	formatClickHouseTimestamp,
	mapApiKeyStatsRow,
	parseClickHouseTimestamp,
	resolveLogPlaceholders,
} from "./mappers";
import { toSpanRows, type SpanBatch, type SpanRow } from "./spans";
import type {
	LogDocument,
	LogListEntry,
	LogDetail,
	LogSearchResult,
	ProjectUsageStats,
	PromptUsageStats,
	ModelUsageStats,
	UserActivityStats,
	ApiKeyUsageStats,
	ProjectDetailedUsageStats,
	ProjectDailyUsageStats,
	ProjectDetailedUsageStatsV2,
	ProjectLogsFilter,
	OrganizationUsageStats,
	OrganizationDetailedUsageStats,
	ClickHouseLogListRow,
	ClickHouseLogDetailRow,
	ClickHouseSpanRow,
	ClickHouseCountRow,
	ClickHouseProjectStatsRow,
	ClickHousePromptStatsRow,
	ClickHouseModelStatsRow,
	ClickHouseUserStatsRow,
	ClickHouseApiKeyStatsRow,
	ClickHouseDailyStatsRow,
	ClickHouseProjectDailyStatsRow,
	DailyStatsAggregation,
	OrganizationDailyUsageStats,
	SourceType,
	LogLevel,
	LogType,
} from "./types";

// Export types for external use
export type {
	SpanBatch,
	SpanRow,
	LogDocument,
	LogListEntry,
	LogDetail,
	LogSearchResult,
	ProjectUsageStats,
	PromptUsageStats,
	ModelUsageStats,
	UserActivityStats,
	ApiKeyUsageStats,
	ProjectDetailedUsageStats,
	ProjectDailyUsageStats,
	ProjectDetailedUsageStatsV2,
	ProjectLogsFilter,
	OrganizationUsageStats,
	OrganizationDetailedUsageStats,
	ClickHouseLogListRow,
	ClickHouseLogDetailRow,
	ClickHouseSpanRow,
	ClickHouseCountRow,
	ClickHouseProjectStatsRow,
	ClickHousePromptStatsRow,
	ClickHouseModelStatsRow,
	ClickHouseUserStatsRow,
	ClickHouseApiKeyStatsRow,
	ClickHouseDailyStatsRow,
	ClickHouseProjectDailyStatsRow,
	DailyStatsAggregation,
	OrganizationDailyUsageStats,
};

export const clickhouseUrl = env.CLICKHOUSE_URL;
export const clickhouseDatabase = env.CLICKHOUSE_DB;
const clickhouseUsername = env.CLICKHOUSE_USER;
const clickhousePassword = env.CLICKHOUSE_PASSWORD;

enum CLICKHOUSE_TABLES {
	LOGS = "logs",
	TRACE_SPANS = "trace_spans",
}

export const clickhouseClient = createClient({
	url: clickhouseUrl,
	database: clickhouseDatabase,
	username: clickhouseUsername,
	password: clickhousePassword,
});

/**
 * A client bound to NO database, for the one statement that cannot assume one exists:
 * CREATE DATABASE.
 *
 * `clickhouseClient` above sends its session database with every request, so using it to
 * bootstrap answers `Database <name> does not exist.` -- and the init script this
 * replaces classified that message as benign, which is how a fresh environment came to be
 * "initialised successfully" into nothing.
 */
export function createAdminClickhouseClient() {
	return createClient({
		url: clickhouseUrl,
		username: clickhouseUsername,
		password: clickhousePassword,
	});
}

// Helper function to build WHERE conditions using WhereBuilder
function buildWhereConditions(
	orgId: number,
	projectId?: number,
	promptId?: number,
	fromDate?: Date,
	toDate?: Date,
	source?: SourceType,
	logLevel?: LogLevel,
	projectIds?: number[],
	query?: string,
) {
	const builder = WhereBuilder.forOrg(orgId);

	if (projectId !== undefined) {
		builder.projectId(projectId);
	}

	if (promptId !== undefined) {
		builder.promptId(promptId);
	}

	if (projectIds !== undefined && projectIds.length > 0) {
		builder.projectIds(projectIds);
	}

	builder.dateRange(fromDate, toDate);

	if (source) {
		builder.source(source);
	}

	if (logLevel) {
		builder.logLevel(logLevel);
	}

	if (query?.trim()) {
		builder.textSearch(query);
	}

	return builder.build();
}

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
	};
}

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

export async function getProjectUsageStats(
	orgId: number,
	projectId: number,
	fromDate?: Date,
	toDate?: Date,
): Promise<ProjectUsageStats> {
	const from = fromDate ?? moment().subtract(30, "days").toDate();
	const to = toDate ?? new Date();

	try {
		const { where, params } = buildWhereConditions(orgId, projectId, undefined, from, to);

		const result = await clickhouseClient.query({
			query: QUERIES.PROJECT_STATS(CLICKHOUSE_TABLES.LOGS, where),
			query_params: params,
			format: "JSONEachRow",
		});

		const data = (await result.json()) as ClickHouseProjectStatsRow[];
		const row = data[0] || {
			total_requests: 0,
			total_tokens_in: 0,
			total_tokens_out: 0,
			total_tokens_sum: 0,
			average_response_ms: 0,
			total_cost: 0,
		};

		return {
			project_id: projectId,
			orgId: orgId,
			total_requests: Number(row.total_requests || 0),
			total_tokens_in: Number(row.total_tokens_in || 0),
			total_tokens_out: Number(row.total_tokens_out || 0),
			total_tokens_sum: Number(row.total_tokens_sum || 0),
			average_response_ms: Math.round(Number(row.average_response_ms || 0)),
			total_cost: Number(row.total_cost || 0),
			// The API still reports the window as days; the QUERY is now exact.
			from_date: moment.utc(from).format("YYYY-MM-DD"),
			to_date: moment.utc(to).format("YYYY-MM-DD"),
		};
	} catch (error) {
		console.error("Error getting project usage stats from ClickHouse:", error);
		throw error;
	}
}

async function getProjectDetailedUsageStats(
	orgId: number,
	projectId: number,
	fromDate?: Date,
	toDate?: Date,
): Promise<ProjectDetailedUsageStats> {
	const from = fromDate ?? moment().subtract(30, "days").toDate();
	const to = toDate ?? new Date();

	try {
		const { where, params } = buildWhereConditions(orgId, projectId, undefined, from, to);

		const aggregate = (query: string) =>
			clickhouseClient.query({ query, query_params: params, format: "JSONEachRow" });

		// Five aggregations over the same rows plus the project totals. They were awaited
		// one after another, so the endpoint cost their SUM (~76ms against a 3M-row table)
		// when it only ever needed their MAX (~27ms) -- none of them reads another's output.
		const [projectStats, promptsResult, modelsResult, usersResult, apiKeysResult] =
			await Promise.all([
				getProjectUsageStats(orgId, projectId, fromDate, toDate),
				aggregate(QUERIES.PROMPT_STATS(CLICKHOUSE_TABLES.LOGS, where)),
				aggregate(QUERIES.MODEL_STATS(CLICKHOUSE_TABLES.LOGS, where)),
				aggregate(
					QUERIES.USER_STATS(CLICKHOUSE_TABLES.LOGS, `${where} AND user_id IS NOT NULL`),
				),
				// Runs from the UI and from testcases carry no key, so they are excluded.
				aggregate(
					QUERIES.API_KEY_STATS(
						CLICKHOUSE_TABLES.LOGS,
						`${where} AND api_key_id IS NOT NULL`,
					),
				),
			]);

		const promptsData = (await promptsResult.json()) as ClickHousePromptStatsRow[];
		const prompts: PromptUsageStats[] = promptsData.map((row) => {
			const totalRequests = Number(row.total_requests || 0);
			const successCount = Number(row.success_count || 0);
			const errorCount = Number(row.error_count || 0);

			return {
				prompt_id: Number(row.prompt_id),
				total_requests: totalRequests,
				total_tokens_in: Number(row.total_tokens_in || 0),
				total_tokens_out: Number(row.total_tokens_out || 0),
				total_tokens_sum: Number(row.total_tokens_sum || 0),
				average_response_ms: Math.round(Number(row.average_response_ms || 0)),
				total_cost: Number(row.total_cost || 0),
				success_rate: totalRequests > 0 ? (successCount / totalRequests) * 100 : 0,
				error_rate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
				last_used: row.last_used ? moment(row.last_used).toISOString() : null,
				first_used: row.first_used ? moment(row.first_used).toISOString() : null,
			};
		});

		const modelsData = (await modelsResult.json()) as ClickHouseModelStatsRow[];
		const models: ModelUsageStats[] = modelsData.map((row) => ({
			model: row.model,
			vendor: row.vendor,
			total_requests: Number(row.total_requests || 0),
			total_tokens_in: Number(row.total_tokens_in || 0),
			total_tokens_out: Number(row.total_tokens_out || 0),
			total_tokens_sum: Number(row.total_tokens_sum || 0),
			total_cost: Number(row.total_cost || 0),
			average_response_ms: Math.round(Number(row.average_response_ms || 0)),
		}));

		const usersData = (await usersResult.json()) as ClickHouseUserStatsRow[];
		const users: UserActivityStats[] = usersData.map((row) => ({
			user_id: Number(row.user_id),
			total_requests: Number(row.total_requests || 0),
			total_tokens_sum: Number(row.total_tokens_sum || 0),
			total_cost: Number(row.total_cost || 0),
			last_activity: row.last_activity ? moment(row.last_activity).toISOString() : null,
			first_activity: row.first_activity ? moment(row.first_activity).toISOString() : null,
		}));

		const apiKeysData = (await apiKeysResult.json()) as ClickHouseApiKeyStatsRow[];
		const api_keys: ApiKeyUsageStats[] = apiKeysData.map(mapApiKeyStatsRow);

		return {
			...projectStats,
			prompts,
			models,
			users,
			api_keys,
		};
	} catch (error) {
		console.error("Error getting detailed project usage stats from ClickHouse:", error);
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
	} catch (error) {
		console.error("Error getting project logs from ClickHouse:", error);
		throw error;
	}
}

export async function getOrganizationDailyUsageStats(
	orgId: number,
	projectIds: number[],
	fromDate?: Date,
	toDate?: Date,
): Promise<OrganizationDailyUsageStats[]> {
	const from = fromDate ?? moment().subtract(30, "days").toDate();
	const to = toDate ?? new Date();

	try {
		const { where, params } = buildWhereConditions(
			orgId,
			undefined,
			undefined,
			from,
			to,
			undefined,
			undefined,
			projectIds,
		);

		// Get daily stats with all aggregations
		const result = await clickhouseClient.query({
			query: QUERIES.ORGANIZATION_DAILY_STATS(CLICKHOUSE_TABLES.LOGS, where),
			query_params: params,
			format: "JSONEachRow",
		});

		const data = (await result.json()) as ClickHouseDailyStatsRow[];

		// Group by date
		const dailyMap = new Map<string, DailyStatsAggregation>();

		for (const row of data) {
			const date = moment(row.date).format("YYYY-MM-DD");

			let dayData = dailyMap.get(date);
			if (!dayData) {
				dayData = {
					date,
					total_requests: 0,
					total_tokens: 0,
					total_cost: 0,
					projects: new Map<
						string,
						{ project_id: number; requests: number; tokens: number }
					>(),
					sources: new Map<string, number>(),
					modelVendorStats: [],
				};
				dailyMap.set(date, dayData);
			}

			dayData.total_requests += Number(row.total_requests || 0);
			dayData.total_tokens += Number(row.total_tokens || 0);
			dayData.total_cost += Number(row.total_cost || 0);

			// Aggregate by project
			const projectKey = String(row.project_id);
			let projectData = dayData.projects.get(projectKey);
			if (!projectData) {
				projectData = {
					project_id: Number(row.project_id),
					requests: 0,
					tokens: 0,
				};
				dayData.projects.set(projectKey, projectData);
			}
			projectData.requests += Number(row.requests || 0);
			projectData.tokens += Number(row.tokens || 0);

			// Aggregate by source
			const sourceKey = row.source || "unknown";
			dayData.sources.set(
				sourceKey,
				(dayData.sources.get(sourceKey) || 0) + Number(row.requests || 0),
			);

			// Add model-vendor stats
			dayData.modelVendorStats.push({
				model: row.model,
				vendor: row.vendor,
				requests: Number(row.requests || 0),
				tokens: Number(row.tokens || 0),
				cost: Number(row.cost || 0),
			});
		}

		// Convert to array format
		return Array.from(dailyMap.values()).map((dayData): OrganizationDailyUsageStats => {
			const sourcesArray: Array<{ source: string; count: number }> = [];
			for (const [source, count] of dayData.sources.entries()) {
				sourcesArray.push({ source, count: Number(count) });
			}

			return {
				date: dayData.date,
				total_requests: dayData.total_requests,
				total_tokens: dayData.total_tokens,
				total_cost: dayData.total_cost,
				projects: Array.from(dayData.projects.values()),
				sources: sourcesArray,
				modelVendorStats: dayData.modelVendorStats,
			};
		});
	} catch (error) {
		console.error("Error getting organization daily usage stats from ClickHouse:", error);
		throw error;
	}
}

export async function getProjectUsageWithDailyStats(
	orgId: number,
	projectId: number,
	fromDate?: Date,
	toDate?: Date,
): Promise<ProjectDetailedUsageStatsV2> {
	const from = fromDate ?? moment().subtract(30, "days").toDate();
	const to = toDate ?? new Date();

	try {
		const { where, params } = buildWhereConditions(orgId, projectId, undefined, from, to);

		// The daily buckets do not depend on the V1 block, so they are read alongside it
		// rather than after it.
		const [projectStats, dailyResult] = await Promise.all([
			getProjectDetailedUsageStats(orgId, projectId, fromDate, toDate),
			clickhouseClient.query({
				query: QUERIES.PROJECT_DAILY_STATS(CLICKHOUSE_TABLES.LOGS, where),
				query_params: params,
				format: "JSONEachRow",
			}),
		]);

		const dailyData = (await dailyResult.json()) as ClickHouseProjectDailyStatsRow[];

		// Create a map of dates with data
		const dailyDataMap = new Map<string, ProjectDailyUsageStats>();
		dailyData.forEach((row) => {
			const date = moment(row.date).format("YYYY-MM-DD");
			dailyDataMap.set(date, {
				date,
				total_requests: Number(row.total_requests || 0),
				total_tokens_sum: Number(row.total_tokens_sum || 0),
				total_cost: Number(row.total_cost || 0),
			});
		});

		// Generate all dates in the range and fill missing dates with zeros
		const daily_stats: ProjectDailyUsageStats[] = [];
		// UTC, to line up with the `toDate(timestamp)` buckets the query groups by.
		const startDate = moment.utc(from);
		const endDate = moment.utc(to);
		const currentDate = startDate.clone();

		while (currentDate.isSameOrBefore(endDate, "day")) {
			const dateStr = currentDate.format("YYYY-MM-DD");
			const existingData = dailyDataMap.get(dateStr);
			if (existingData) {
				daily_stats.push(existingData);
			} else {
				daily_stats.push({
					date: dateStr,
					total_requests: 0,
					total_tokens_sum: 0,
					total_cost: 0,
				});
			}
			currentDate.add(1, "day");
		}

		return {
			...projectStats,
			daily_stats,
		};
	} catch (error) {
		console.error("Error getting detailed project usage stats V2 from ClickHouse:", error);
		throw error;
	}
}

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

export async function countRunsByDate(startDate: Date, endDate: Date): Promise<number> {
	// UTC like every other timestamp that reaches ClickHouse -- see formatClickHouseTimestamp.
	const fromDateStr = formatClickHouseTimestamp(startDate);
	const toDateStr = formatClickHouseTimestamp(endDate);

	try {
		const result = await clickhouseClient.query({
			query: QUERIES.COUNT_BY_DATE(CLICKHOUSE_TABLES.LOGS),
			query_params: {
				fromDate: fromDateStr,
				toDate: toDateStr,
			},
			format: "JSONEachRow",
		});

		const data = (await result.json()) as ClickHouseCountRow[];
		return Number(data[0]?.total || 0);
	} catch (error) {
		console.error("Error counting runs by date from ClickHouse:", error);
		throw error;
	}
}
