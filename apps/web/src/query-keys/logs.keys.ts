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

export const logsKeys = {
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
	projectMemories: (selectedPromptId?: ScopeParam) =>
		["project-logs-memories", selectedPromptId] as const,
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
	promptMemoriesTab: (promptId?: ScopeParam) => ["prompt-memories-tab", promptId] as const,
};

