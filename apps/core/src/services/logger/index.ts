/**
 * Logger Service - Main Export
 * Unified interface for ClickHouse logging functionality
 */

// Export all public functions
export {
	logUsage,
	logSpans,
	insertSpanRows,
	getSessionTraceIds,
	getPromptLogs,
	getProjectUsageStats,
	getProjectLogs,
	getOrganizationDailyUsageStats,
	getProjectUsageWithDailyStats,
	getSessionSpans,
	countRunsByDate,
	clickhouseClient,
	clickhouseUrl,
	clickhouseDatabase,
} from "./logger";

export { deriveTurnTraceId } from "./spans";

// Export types
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
	ClickHouseCountRow,
	ClickHouseProjectStatsRow,
	ClickHousePromptStatsRow,
	ClickHouseModelStatsRow,
	ClickHouseUserStatsRow,
	ClickHouseDailyStatsRow,
	ClickHouseProjectDailyStatsRow,
	DailyStatsAggregation,
	OrganizationDailyUsageStats,
} from "./logger";

export { SourceType, LogLevel, LogType } from "./types";

// Export utilities (if needed externally)
export { WhereBuilder } from "./where.builder";
export type { QueryParams } from "./where.builder";
