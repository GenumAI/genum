export interface Log {
	log_lvl: string;
	timestamp: string;
	source: string;
	vendor: string;
	model: string;
	tokens_sum: number;
	cost: number;
	response_ms: number;
	description?: string;
	tokens_in?: number;
	tokens_out?: number;
	in?: string;
	out?: string;
	log_type?: string;
	user_name?: string;
	placeholders?: Record<string, string>;
	api?: string;
	prompt_id?: number;
	/**
	 * Set on a run that recorded a trajectory. The backend has always sent it
	 * (`transformRowToLogDocument`); it is what turns "add testcase from log" into the
	 * step picker instead of a plain text testcase.
	 */
	trace_id?: string;
}

export interface LogsResponse {
	logs: Log[];
	total: number;
}

export interface PromptName {
	id: number;
	name: string;
}
