/**
 * Aggregate reads of the `logs` table: the usage dashboards of a project and an
 * organisation, and the run count the admin overview reports.
 */

import moment from "moment";
import { CLICKHOUSE_TABLES, clickhouseClient } from "./client";
import { formatClickHouseTimestamp, mapApiKeyStatsRow } from "./mappers";
import { QUERIES } from "./queries";
import { buildWhereConditions } from "./where.builder";
import type {
	ProjectUsageStats,
	PromptUsageStats,
	ModelUsageStats,
	UserActivityStats,
	ApiKeyUsageStats,
	ProjectDetailedUsageStats,
	ProjectDailyUsageStats,
	ProjectDetailedUsageStatsV2,
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
} from "./types";

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
