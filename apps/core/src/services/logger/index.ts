/**
 * Logger Service - Main Export
 * Unified interface for ClickHouse logging functionality
 */

// Export all public functions
export {
	logUsage,
	getPromptLogs,
	getProjectUsageStats,
	getProjectLogs,
	getOrganizationDailyUsageStats,
	getProjectUsageWithDailyStats,
	countRunsByDate,
	clickhouseClient,
	clickhouseUrl,
	clickhouseDatabase,
} from "./logger";

// Export types
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
} from "./logger";

export { SourceType, LogLevel, LogType } from "./types";

// Export utilities (if needed externally)
export { WhereBuilder } from "./where.builder";
export type { QueryParams } from "./where.builder";
