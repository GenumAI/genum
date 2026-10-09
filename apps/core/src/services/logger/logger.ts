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
 *
 * This file is the service's public surface and defines nothing itself. Callers import
 * from here and tests `vi.mock` this path, so the implementation sits beside it instead:
 * - client.ts         the ClickHouse client and the tables it addresses
 * - write.ts          logUsage, logSpans, insertSpanRows
 * - log-queries.ts    the paged log lists and one row's detail
 * - stats-queries.ts  the usage dashboards and the admin run count
 * - span-queries.ts   a session's spans and trace ids
 */

import type { SpanBatch, SpanRow } from "./spans";
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
} from "./types";

export {
	clickhouseUrl,
	clickhouseDatabase,
	clickhouseClient,
	createAdminClickhouseClient,
} from "./client";
export { logUsage, logSpans, insertSpanRows } from "./write";
export { getPromptLogs, getLogDetail, getProjectLogs } from "./log-queries";
export {
	getProjectUsageStats,
	getOrganizationDailyUsageStats,
	getProjectUsageWithDailyStats,
	countRunsByDate,
} from "./stats-queries";
export { getSessionSpans, getSessionTraceIds } from "./span-queries";

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
