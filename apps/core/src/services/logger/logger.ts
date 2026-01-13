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
import type {
	LogDocument,
	LogSearchResult,
	ProjectUsageStats,
	PromptUsageStats,
	ModelUsageStats,
	UserActivityStats,
	ProjectDetailedUsageStats,
	ProjectDailyUsageStats,
	ProjectDetailedUsageStatsV2,
	ProjectLogsFilter,
	OrganizationUsageStats,
	OrganizationDetailedUsageStats,
	ClickHouseLogRow,
	ClickHouseCountRow,
	ClickHouseProjectStatsRow,
	ClickHousePromptStatsRow,
	ClickHouseModelStatsRow,
	ClickHouseUserStatsRow,
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
	LogDocument,
	LogSearchResult,
	ProjectUsageStats,
	PromptUsageStats,
	ModelUsageStats,
	UserActivityStats,
	ProjectDetailedUsageStats,
	ProjectDailyUsageStats,
	ProjectDetailedUsageStatsV2,
	ProjectLogsFilter,
	OrganizationUsageStats,
	OrganizationDetailedUsageStats,
	ClickHouseLogRow,
	ClickHouseCountRow,
	ClickHouseProjectStatsRow,
	ClickHousePromptStatsRow,
	ClickHouseModelStatsRow,
	ClickHouseUserStatsRow,
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
}

export const clickhouseClient = createClient({
	url: clickhouseUrl,
	database: clickhouseDatabase,
	username: clickhouseUsername,
	password: clickhousePassword,
});

// Helper function to build WHERE conditions
function buildWhereConditions(
	orgId: number,
	projectId?: number,
	promptId?: number,
	fromDate?: string,
	toDate?: string,
	source?: SourceType,
	logLevel?: LogLevel,
	projectIds?: number[],
	query?: string,
): string {
	const conditions: string[] = [`orgId = ${orgId}`];

	if (projectId !== undefined) {
		conditions.push(`project_id = ${projectId}`);
	}

	if (promptId !== undefined) {
		conditions.push(`prompt_id = ${promptId}`);
	}

	if (projectIds !== undefined && projectIds.length > 0) {
		conditions.push(`project_id IN (${projectIds.join(",")})`);
	}

	if (fromDate) {
		conditions.push(`timestamp >= '${fromDate} 00:00:00'`);
	}

	if (toDate) {
		conditions.push(`timestamp <= '${toDate} 23:59:59'`);
	}

	if (source) {
		conditions.push(`source = '${source}'`);
	}

	if (logLevel) {
		conditions.push(`log_lvl = '${logLevel}'`);
	}

	if (query?.trim()) {
		// Escape single quotes in query to prevent SQL injection
		const escapedQuery = query.replace(/'/g, "''");
		// Search in both 'in' and 'out' fields (case-insensitive)
		// Use backticks for field names as 'in' is a reserved word in SQL
		conditions.push(
			`(position(lower(\`in\`), lower('${escapedQuery}')) > 0 OR position(lower(\`out\`), lower('${escapedQuery}')) > 0)`,
		);
	}

	return conditions.join(" AND ");
}

// Helper function to transform ClickHouse row to LogDocument
function transformRowToLogDocument(row: ClickHouseLogRow): LogDocument {
	return {
		timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
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
		vendor: row.vendor,
		model: row.model,
		tokens_in: row.tokens_in,
		tokens_out: row.tokens_out,
		tokens_sum: row.tokens_sum,
		cost: row.cost,
		response_ms: row.response_ms,
		in: row.in,
		out: row.out,
		memory_key: row.memory_key || undefined,
	};
}

export async function logUsage(document: LogDocument): Promise<void> {
	const timestamp = document.timestamp ?? new Date();

	try {
		// Format timestamp as YYYY-MM-DD HH:mm:ss.SSS for ClickHouse DateTime64
		const timestampStr = moment(timestamp).format("YYYY-MM-DD HH:mm:ss.SSS");

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
					vendor: document.vendor,
					model: document.model,
					tokens_in: document.tokens_in,
					tokens_out: document.tokens_out,
					tokens_sum: document.tokens_sum,
					cost: document.cost,
					response_ms: document.response_ms,
					in: document.in,
					out: document.out,
					memory_key: document.memory_key || null,
					stage: env.NODE_ENV,
				},
			],
			format: "JSONEachRow",
		});
	} catch (error) {
		console.error("Ошибка записи лога в ClickHouse:", error);
		throw error;
	}
}

export async function getPromptLogs(
	orgId: number,
	promptId: number,
	page: number = 1,
	pageSize: number = 10,
	fromDate?: Date,
	toDate?: Date,
	source?: SourceType,
	logLevel?: LogLevel,
	query?: string,
): Promise<LogSearchResult> {
	const fromDateStr = fromDate
		? moment(fromDate).format("YYYY-MM-DD")
		: moment().subtract(30, "days").format("YYYY-MM-DD");
	const toDateStr = toDate ? moment(toDate).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");

	try {
		const whereClause = buildWhereConditions(
			orgId,
			undefined,
			promptId,
			fromDateStr,
			toDateStr,
			source,
			logLevel,
			undefined,
			query,
		);

		// Get total count
		const countResult = await clickhouseClient.query({
			query: `SELECT count() as total FROM ${CLICKHOUSE_TABLES.LOGS} WHERE ${whereClause}`,
			format: "JSONEachRow",
		});

		const countData = (await countResult.json()) as ClickHouseCountRow[];
		const total = countData[0]?.total || 0;

		// Get logs with pagination
		const offset = (page - 1) * pageSize;
		const logsResult = await clickhouseClient.query({
			query: `
				SELECT * FROM ${CLICKHOUSE_TABLES.LOGS}
				WHERE ${whereClause}
				ORDER BY timestamp DESC
				LIMIT ${pageSize} OFFSET ${offset}
			`,
			format: "JSONEachRow",
		});

		const logsData = (await logsResult.json()) as ClickHouseLogRow[];
		const logs = logsData.map(transformRowToLogDocument);

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

export async function getProjectUsageStats(
	orgId: number,
	projectId: number,
	fromDate?: Date,
	toDate?: Date,
): Promise<ProjectUsageStats> {
	const fromDateStr = fromDate
		? moment(fromDate).format("YYYY-MM-DD")
		: moment().subtract(30, "days").format("YYYY-MM-DD");
	const toDateStr = toDate ? moment(toDate).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");

	try {
		const whereClause = buildWhereConditions(
			orgId,
			projectId,
			undefined,
			fromDateStr,
			toDateStr,
		);

		const result = await clickhouseClient.query({
			query: `
				SELECT
					count() as total_requests,
					sum(tokens_in) as total_tokens_in,
					sum(tokens_out) as total_tokens_out,
					sum(tokens_sum) as total_tokens_sum,
					avg(response_ms) as average_response_ms,
					sum(cost) as total_cost
				FROM ${CLICKHOUSE_TABLES.LOGS}
				WHERE ${whereClause}
			`,
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
			from_date: fromDateStr,
			to_date: toDateStr,
		};
	} catch (error) {
		console.error("Error getting project usage stats from ClickHouse:", error);
		throw error;
	}
}

export async function getProjectDetailedUsageStats(
	orgId: number,
	projectId: number,
	fromDate?: Date,
	toDate?: Date,
): Promise<ProjectDetailedUsageStats> {
	const fromDateStr = fromDate
		? moment(fromDate).format("YYYY-MM-DD")
		: moment().subtract(30, "days").format("YYYY-MM-DD");
	const toDateStr = toDate ? moment(toDate).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");

	try {
		// First, get project-level statistics
		const projectStats = await getProjectUsageStats(orgId, projectId, fromDate, toDate);

		// Then, get detailed statistics by prompt, model, and user
		const whereClause = buildWhereConditions(
			orgId,
			projectId,
			undefined,
			fromDateStr,
			toDateStr,
		);

		// Get prompts stats
		const promptsResult = await clickhouseClient.query({
			query: `
				SELECT
					prompt_id,
					count() as total_requests,
					sum(tokens_in) as total_tokens_in,
					sum(tokens_out) as total_tokens_out,
					sum(tokens_sum) as total_tokens_sum,
					avg(response_ms) as average_response_ms,
					sum(cost) as total_cost,
					sum(if(log_lvl = 'SUCCESS', 1, 0)) as success_count,
					sum(if(log_lvl = 'ERROR', 1, 0)) as error_count,
					max(timestamp) as last_used,
					min(timestamp) as first_used
				FROM ${CLICKHOUSE_TABLES.LOGS}
				WHERE ${whereClause}
				GROUP BY prompt_id
				ORDER BY total_requests DESC
				LIMIT 100
			`,
			format: "JSONEachRow",
		});

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

		// Get models stats
		const modelsResult = await clickhouseClient.query({
			query: `
				SELECT
					model,
					vendor,
					count() as total_requests,
					sum(tokens_in) as total_tokens_in,
					sum(tokens_out) as total_tokens_out,
					sum(tokens_sum) as total_tokens_sum,
					avg(response_ms) as average_response_ms,
					sum(cost) as total_cost
				FROM ${CLICKHOUSE_TABLES.LOGS}
				WHERE ${whereClause}
				GROUP BY model, vendor
				ORDER BY total_requests DESC
				LIMIT 100
			`,
			format: "JSONEachRow",
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

		// Get users stats
		const usersResult = await clickhouseClient.query({
			query: `
				SELECT
					user_id,
					count() as total_requests,
					sum(tokens_sum) as total_tokens_sum,
					sum(cost) as total_cost,
					max(timestamp) as last_activity,
					min(timestamp) as first_activity
				FROM ${CLICKHOUSE_TABLES.LOGS}
				WHERE ${whereClause} AND user_id IS NOT NULL
				GROUP BY user_id
				ORDER BY total_requests DESC
				LIMIT 100
			`,
			format: "JSONEachRow",
		});

		const usersData = (await usersResult.json()) as ClickHouseUserStatsRow[];
		const users: UserActivityStats[] = usersData.map((row) => ({
			user_id: Number(row.user_id),
			total_requests: Number(row.total_requests || 0),
			total_tokens_sum: Number(row.total_tokens_sum || 0),
			total_cost: Number(row.total_cost || 0),
			last_activity: row.last_activity ? moment(row.last_activity).toISOString() : null,
			first_activity: row.first_activity ? moment(row.first_activity).toISOString() : null,
		}));

		return {
			...projectStats,
			prompts,
			models,
			users,
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
	const fromDateStr = filters?.fromDate
		? moment(filters.fromDate).format("YYYY-MM-DD")
		: moment().subtract(30, "days").format("YYYY-MM-DD");
	const toDateStr = filters?.toDate
		? moment(filters.toDate).format("YYYY-MM-DD")
		: moment().format("YYYY-MM-DD");

	try {
		const whereClause = buildWhereConditions(
			orgId,
			projectId,
			filters?.promptId,
			fromDateStr,
			toDateStr,
			filters?.source,
			filters?.logLevel,
			undefined,
			filters?.query,
		);

		// Get total count
		const countResult = await clickhouseClient.query({
			query: `SELECT count() as total FROM ${CLICKHOUSE_TABLES.LOGS} WHERE ${whereClause}`,
			format: "JSONEachRow",
		});

		const countData = (await countResult.json()) as ClickHouseCountRow[];
		const total = countData[0]?.total || 0;

		// Get logs with pagination
		const offset = (page - 1) * pageSize;
		const logsResult = await clickhouseClient.query({
			query: `
				SELECT * FROM ${CLICKHOUSE_TABLES.LOGS}
				WHERE ${whereClause}
				ORDER BY timestamp DESC
				LIMIT ${pageSize} OFFSET ${offset}
			`,
			format: "JSONEachRow",
		});

		const logsData = (await logsResult.json()) as ClickHouseLogRow[];
		const logs = logsData.map(transformRowToLogDocument);

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

export async function getOrganizationUsageStats(
	orgId: number,
	projectIds: number[],
	fromDate?: Date,
	toDate?: Date,
): Promise<OrganizationUsageStats> {
	const fromDateStr = fromDate
		? moment(fromDate).format("YYYY-MM-DD")
		: moment().subtract(30, "days").format("YYYY-MM-DD");
	const toDateStr = toDate ? moment(toDate).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");

	try {
		const whereClause = buildWhereConditions(
			orgId,
			undefined,
			undefined,
			fromDateStr,
			toDateStr,
			undefined,
			undefined,
			projectIds,
		);

		// Get organization-level stats
		const orgResult = await clickhouseClient.query({
			query: `
				SELECT
					count() as total_requests,
					sum(tokens_in) as total_tokens_in,
					sum(tokens_out) as total_tokens_out,
					sum(tokens_sum) as total_tokens_sum,
					avg(response_ms) as average_response_ms,
					sum(cost) as total_cost
				FROM ${CLICKHOUSE_TABLES.LOGS}
				WHERE ${whereClause}
			`,
			format: "JSONEachRow",
		});

		const orgData = (await orgResult.json()) as ClickHouseProjectStatsRow[];
		const orgRow = orgData[0] || {
			total_requests: 0,
			total_tokens_in: 0,
			total_tokens_out: 0,
			total_tokens_sum: 0,
			average_response_ms: 0,
			total_cost: 0,
		};

		// Get stats for each project
		const projects: ProjectUsageStats[] = [];
		for (const projectId of projectIds) {
			const stats = await getProjectUsageStats(orgId, projectId, fromDate, toDate);
			projects.push(stats);
		}

		return {
			orgId,
			total_requests: Number(orgRow.total_requests || 0),
			total_tokens_in: Number(orgRow.total_tokens_in || 0),
			total_tokens_out: Number(orgRow.total_tokens_out || 0),
			total_tokens_sum: Number(orgRow.total_tokens_sum || 0),
			average_response_ms: Math.round(Number(orgRow.average_response_ms || 0)),
			total_cost: Number(orgRow.total_cost || 0),
			from_date: fromDateStr,
			to_date: toDateStr,
			projects,
		};
	} catch (error) {
		console.error("Error getting organization usage stats from ClickHouse:", error);
		throw error;
	}
}

export async function getOrganizationDailyUsageStats(
	orgId: number,
	projectIds: number[],
	fromDate?: Date,
	toDate?: Date,
): Promise<OrganizationDailyUsageStats[]> {
	const fromDateStr = fromDate
		? moment(fromDate).format("YYYY-MM-DD")
		: moment().subtract(30, "days").format("YYYY-MM-DD");
	const toDateStr = toDate ? moment(toDate).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");

	try {
		const whereClause = buildWhereConditions(
			orgId,
			undefined,
			undefined,
			fromDateStr,
			toDateStr,
			undefined,
			undefined,
			projectIds,
		);

		// Get daily stats with all aggregations
		const result = await clickhouseClient.query({
			query: `
				SELECT
					toDate(timestamp) as date,
					count() as total_requests,
					sum(tokens_sum) as total_tokens,
					sum(cost) as total_cost,
					project_id,
					source,
					vendor,
					model,
					count() as requests,
					sum(tokens_sum) as tokens,
					sum(cost) as cost
				FROM ${CLICKHOUSE_TABLES.LOGS}
				WHERE ${whereClause}
				GROUP BY date, project_id, source, vendor, model
				ORDER BY date
			`,
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

export async function getProjectDetailedUsageStatsV2(
	orgId: number,
	projectId: number,
	fromDate?: Date,
	toDate?: Date,
): Promise<ProjectDetailedUsageStatsV2> {
	const fromDateStr = fromDate
		? moment(fromDate).format("YYYY-MM-DD")
		: moment().subtract(30, "days").format("YYYY-MM-DD");
	const toDateStr = toDate ? moment(toDate).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");

	try {
		// First, get project-level statistics (same as V1)
		const projectStats = await getProjectDetailedUsageStats(orgId, projectId, fromDate, toDate);

		// Then, get daily statistics
		const whereClause = buildWhereConditions(
			orgId,
			projectId,
			undefined,
			fromDateStr,
			toDateStr,
		);

		const dailyResult = await clickhouseClient.query({
			query: `
				SELECT
					toDate(timestamp) as date,
					count() as total_requests,
					sum(tokens_sum) as total_tokens_sum,
					sum(cost) as total_cost
				FROM ${CLICKHOUSE_TABLES.LOGS}
				WHERE ${whereClause}
				GROUP BY date
				ORDER BY date
			`,
			format: "JSONEachRow",
		});

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
		const startDate = moment(fromDateStr);
		const endDate = moment(toDateStr);
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

export async function countRunsByDate(startDate: Date, endDate: Date): Promise<number> {
	const fromDateStr = moment(startDate).format("YYYY-MM-DD HH:mm:ss");
	const toDateStr = moment(endDate).format("YYYY-MM-DD HH:mm:ss");

	try {
		const result = await clickhouseClient.query({
			query: `
				SELECT count() as total
				FROM ${CLICKHOUSE_TABLES.LOGS}
				WHERE timestamp >= '${fromDateStr}' AND timestamp <= '${toDateStr}'
			`,
			format: "JSONEachRow",
		});

		const data = (await result.json()) as ClickHouseCountRow[];
		return Number(data[0]?.total || 0);
	} catch (error) {
		console.error("Error counting runs by date from ClickHouse:", error);
		throw error;
	}
}
