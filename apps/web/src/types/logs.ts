/**
 * One row of a log list.
 *
 * `in`, `out` and `placeholders` are deliberately NOT here: a list of ten rows used to
 * carry the full prompt and the full model answer for every row the query scanned, which
 * is what exhausted ClickHouse's query memory limit on `GET /prompts/:id/logs`. The
 * payload lives in `LogDetail`, fetched for the one row a user opens.
 */
export interface Log {
	/**
	 * Addresses this row for `LogDetail`. A `UInt64` kept as a string end to end -- as a
	 * number it would round and address nothing.
	 */
	log_id: string;
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
	log_type?: string;
	user_name?: string;
	api?: string;
	prompt_id?: number;
	/**
	 * Set on a run that recorded a trajectory. The backend has always sent it
	 * (`transformRowToLogDocument`); it is what turns "add testcase from log" into the
	 * step picker instead of a plain text testcase.
	 */
	trace_id?: string;
}

/** The payload half of a log row, fetched when the details dialog opens. */
export interface LogDetail {
	log_id: string;
	in: string;
	out: string;
	placeholders?: Record<string, string>;
}

export interface LogsResponse {
	logs: Log[];
	total: number;
}

export interface PromptName {
	id: number;
	name: string;
}
