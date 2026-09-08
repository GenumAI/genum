type ScopeParam = string | number | undefined;

export interface ProjectLogsKeyParams {
	page: number;
	pageSize: number;
	fromDate?: string;
	toDate?: string;
	logLevel?: string;
	model?: string;
	source?: string;
	query?: string;
	promptId?: ScopeParam;
}

export interface PromptLogsKeyParams {
	promptId?: ScopeParam;
	page: number;
	pageSize: number;
	fromDate?: string;
	toDate?: string;
	logLevel?: string;
	model?: string;
	source?: string;
	query?: string;
}

export interface LogDetailKeyParams {
	promptId?: ScopeParam;
	logId?: string;
	timestamp?: string;
}

export const logsKeys = {
	/** A single row's payload. `promptId` is part of the key because the prompt-scoped and
	 * project-scoped endpoints enforce different access boundaries and must not share a
	 * cache entry. */
	logDetail: ({ promptId, logId, timestamp }: LogDetailKeyParams) =>
		["log-detail", promptId, logId, timestamp] as const,
	projectLogs: ({
		page,
		pageSize,
		fromDate,
		toDate,
		logLevel,
		model,
		source,
		query,
		promptId,
	}: ProjectLogsKeyParams) =>
		[
			"project-logs",
			page,
			pageSize,
			fromDate,
			toDate,
			logLevel,
			model,
			source,
			query,
			promptId,
		] as const,
	promptLogs: ({
		promptId,
		page,
		pageSize,
		fromDate,
		toDate,
		logLevel,
		model,
		source,
		query,
	}: PromptLogsKeyParams) =>
		[
			"prompt-logs-tab",
			promptId,
			page,
			pageSize,
			fromDate,
			toDate,
			logLevel,
			model,
			source,
			query,
		] as const,
};
