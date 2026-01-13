/**
 * Types for Logger Service
 */

export enum SourceType {
	ui = "ui",
	testcase = "testcase",
	api = "api",
}

export enum LogLevel {
	success = "SUCCESS",
	info = "INFO",
	warn = "WARN",
	error = "ERROR",
}

export enum LogType {
	PromptRunSuccess = "prs",
	PromptRunError = "pre",
	AIError = "ae",
	TechnicalError = "te",
}

export interface LogDocument {
	// metadata
	timestamp?: Date;
	source: SourceType;

	// response
	log_lvl: LogLevel;
	log_type: LogType;
	description?: string;

	// project info
	orgId: number;
	project_id: number;
	prompt_id: number;
	user_id?: number;
	api_key_id?: number;
	testcase_id?: number;

	// AI info
	vendor: string;
	model: string;
	tokens_in: number;
	tokens_out: number;
	tokens_sum: number;
	cost: number;
	response_ms: number;

	// payload
	in: string;
	out: string;
	memory_key?: string;
}

export interface LogSearchResult {
	logs: LogDocument[];
	total: number;
	page: number;
	pageSize: number;
}

export interface ProjectUsageStats {
	project_id: number;
	orgId: number;
	total_requests: number;
	total_tokens_in: number;
	total_tokens_out: number;
	total_tokens_sum: number;
	average_response_ms: number;
	total_cost: number;
	from_date: string;
	to_date: string;
}

export interface PromptUsageStats {
	prompt_id: number;
	total_requests: number;
	total_tokens_in: number;
	total_tokens_out: number;
	total_tokens_sum: number;
	average_response_ms: number;
	total_cost: number;
	success_rate: number;
	error_rate: number;
	last_used: string | null;
	first_used: string | null;
}

export interface ModelUsageStats {
	model: string;
	vendor: string;
	total_requests: number;
	total_tokens_in: number;
	total_tokens_out: number;
	total_tokens_sum: number;
	total_cost: number;
	average_response_ms: number;
}

export interface UserActivityStats {
	user_id: number;
	total_requests: number;
	total_tokens_sum: number;
	total_cost: number;
	last_activity: string | null;
	first_activity: string | null;
}

export interface ProjectDetailedUsageStats {
	project_id: number;
	orgId: number;
	from_date: string;
	to_date: string;
	total_requests: number;
	total_tokens_in: number;
	total_tokens_out: number;
	total_tokens_sum: number;
	average_response_ms: number;
	total_cost: number;
	prompts: PromptUsageStats[];
	models: ModelUsageStats[];
	users: UserActivityStats[];
}

export interface ProjectDailyUsageStats {
	date: string;
	total_requests: number;
	total_tokens_sum: number;
	total_cost: number;
}

export interface ProjectDetailedUsageStatsV2 extends ProjectDetailedUsageStats {
	daily_stats: ProjectDailyUsageStats[];
}

export interface ProjectLogsFilter {
	logLevel?: LogLevel;
	promptId?: number;
	fromDate?: Date;
	toDate?: Date;
	source?: SourceType;
	query?: string;
}

export interface OrganizationUsageStats {
	orgId: number;
	total_requests: number;
	total_tokens_in: number;
	total_tokens_out: number;
	total_tokens_sum: number;
	average_response_ms: number;
	total_cost: number;
	from_date: string;
	to_date: string;
	projects: ProjectUsageStats[];
}

export interface OrganizationDetailedUsageStats extends OrganizationUsageStats {
	projects: ProjectDetailedUsageStats[];
}

// ClickHouse row types
export interface ClickHouseLogRow {
	timestamp: string;
	source: string;
	log_lvl: string;
	log_type: string;
	description: string | null;
	orgId: number;
	project_id: number;
	prompt_id: number;
	user_id: number | null;
	api_key_id: number | null;
	testcase_id: number | null;
	vendor: string;
	model: string;
	tokens_in: number;
	tokens_out: number;
	tokens_sum: number;
	cost: number;
	response_ms: number;
	in: string;
	out: string;
	memory_key: string | null;
	stage?: string;
}

export interface ClickHouseCountRow {
	total: number | string;
}

export interface ClickHouseProjectStatsRow {
	total_requests: number | string;
	total_tokens_in: number | string;
	total_tokens_out: number | string;
	total_tokens_sum: number | string;
	average_response_ms: number | string;
	total_cost: number | string;
}

export interface ClickHousePromptStatsRow {
	prompt_id: number | string;
	total_requests: number | string;
	total_tokens_in: number | string;
	total_tokens_out: number | string;
	total_tokens_sum: number | string;
	average_response_ms: number | string;
	total_cost: number | string;
	success_count: number | string;
	error_count: number | string;
	last_used: string | null;
	first_used: string | null;
}

export interface ClickHouseModelStatsRow {
	model: string;
	vendor: string;
	total_requests: number | string;
	total_tokens_in: number | string;
	total_tokens_out: number | string;
	total_tokens_sum: number | string;
	total_cost: number | string;
	average_response_ms: number | string;
}

export interface ClickHouseUserStatsRow {
	user_id: number | string;
	total_requests: number | string;
	total_tokens_sum: number | string;
	total_cost: number | string;
	last_activity: string | null;
	first_activity: string | null;
}

export interface ClickHouseDailyStatsRow {
	date: string;
	total_requests: number | string;
	total_tokens: number | string;
	total_cost: number | string;
	project_id: number | string;
	source: string;
	vendor: string;
	model: string;
	requests: number | string;
	tokens: number | string;
	cost: number | string;
}

export interface ClickHouseProjectDailyStatsRow {
	date: string;
	total_requests: number | string;
	total_tokens_sum: number | string;
	total_cost: number | string;
}

// Internal types for daily stats aggregation
export interface DailyStatsAggregation {
	date: string;
	total_requests: number;
	total_tokens: number;
	total_cost: number;
	projects: Map<string, { project_id: number; requests: number; tokens: number }>;
	sources: Map<string, number>;
	modelVendorStats: ModelVendorDailyStats[];
}

export interface ModelVendorDailyStats {
	model: string;
	vendor: string;
	requests: number;
	tokens: number;
	cost: number;
}

export interface OrganizationDailyUsageStats {
	date: string;
	total_requests: number;
	total_tokens: number;
	total_cost: number;
	projects: Array<{
		project_id: number;
		requests: number;
		tokens: number;
	}>;
	sources: Array<{
		source: string;
		count: number;
	}>;
	modelVendorStats: ModelVendorDailyStats[];
}
