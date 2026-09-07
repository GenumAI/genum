/**
 * SQL Queries for ClickHouse Logger
 * All queries use parameterized WHERE clauses for SQL injection protection
 */

/**
 * A trajectory's continuation turns ("prt") are real provider calls -- their tokens and
 * cost belong in every sum -- but they are turns of ONE run, not N runs. Counting them
 * would inflate run counts and deflate every per-run cost average, which is the whole
 * reason the type exists (see `LogType.PromptRunTurn`). Expressed as a `countIf` rather
 * than a WHERE clause so the sums beside it still cover every billed turn.
 */
const RUN_COUNT = "countIf(log_type != 'prt')";

export const QUERIES = {
	/**
	 * Count total records matching WHERE clause
	 */
	COUNT: (table: string, where: string) => `
		SELECT count() as total 
		FROM ${table} 
		WHERE ${where}
	`,

	/**
	 * Get logs with pagination
	 */
	GET_LOGS: (table: string, where: string) => `
		SELECT * 
		FROM ${table}
		WHERE ${where}
		ORDER BY timestamp DESC
		LIMIT {limit: UInt64} OFFSET {offset: UInt64}
	`,

	/**
	 * Get project-level statistics
	 */
	PROJECT_STATS: (table: string, where: string) => `
		SELECT
			${RUN_COUNT} as total_requests,
			sum(tokens_in) as total_tokens_in,
			sum(tokens_out) as total_tokens_out,
			sum(tokens_sum) as total_tokens_sum,
			avg(response_ms) as average_response_ms,
			sum(cost) as total_cost
		FROM ${table}
		WHERE ${where}
	`,

	/**
	 * Get prompt-level statistics with success/error rates
	 */
	PROMPT_STATS: (table: string, where: string) => `
		SELECT
			prompt_id,
			${RUN_COUNT} as total_requests,
			sum(tokens_in) as total_tokens_in,
			sum(tokens_out) as total_tokens_out,
			sum(tokens_sum) as total_tokens_sum,
			avg(response_ms) as average_response_ms,
			sum(cost) as total_cost,
			countIf(log_lvl = 'SUCCESS' AND log_type != 'prt') as success_count,
			countIf(log_lvl = 'ERROR') as error_count,
			max(timestamp) as last_used,
			min(timestamp) as first_used
		FROM ${table}
		WHERE ${where}
		GROUP BY prompt_id
		ORDER BY total_requests DESC
		LIMIT 100
	`,

	/**
	 * Get model-level statistics by vendor
	 */
	MODEL_STATS: (table: string, where: string) => `
		SELECT
			model,
			vendor,
			${RUN_COUNT} as total_requests,
			sum(tokens_in) as total_tokens_in,
			sum(tokens_out) as total_tokens_out,
			sum(tokens_sum) as total_tokens_sum,
			avg(response_ms) as average_response_ms,
			sum(cost) as total_cost
		FROM ${table}
		WHERE ${where}
		GROUP BY model, vendor
		ORDER BY total_requests DESC
		LIMIT 100
	`,

	/**
	 * Get user activity statistics
	 */
	USER_STATS: (table: string, where: string) => `
		SELECT
			user_id,
			${RUN_COUNT} as total_requests,
			sum(tokens_sum) as total_tokens_sum,
			sum(cost) as total_cost,
			max(timestamp) as last_activity,
			min(timestamp) as first_activity
		FROM ${table}
		WHERE ${where}
		GROUP BY user_id
		ORDER BY total_requests DESC
		LIMIT 100
	`,

	/**
	 * Get API key activity statistics
	 */
	API_KEY_STATS: (table: string, where: string) => `
		SELECT
			api_key_id,
			${RUN_COUNT} as total_requests,
			sum(tokens_sum) as total_tokens_sum,
			sum(cost) as total_cost,
			max(timestamp) as last_activity
		FROM ${table}
		WHERE ${where}
		GROUP BY api_key_id
		ORDER BY total_requests DESC
		LIMIT 100
	`,

	/**
	 * Get daily statistics for a project
	 */
	PROJECT_DAILY_STATS: (table: string, where: string) => `
		SELECT
			toDate(timestamp) as date,
			${RUN_COUNT} as total_requests,
			sum(tokens_sum) as total_tokens_sum,
			sum(cost) as total_cost
		FROM ${table}
		WHERE ${where}
		GROUP BY date
		ORDER BY date
	`,

	/**
	 * Get daily statistics for organization with detailed breakdowns
	 */
	ORGANIZATION_DAILY_STATS: (table: string, where: string) => `
		SELECT
			toDate(timestamp) as date,
			${RUN_COUNT} as total_requests,
			sum(tokens_sum) as total_tokens,
			sum(cost) as total_cost,
			project_id,
			source,
			vendor,
			model,
			${RUN_COUNT} as requests,
			sum(tokens_sum) as tokens,
			sum(cost) as cost
		FROM ${table}
		WHERE ${where}
		GROUP BY date, project_id, source, vendor, model
		ORDER BY date
	`,

	/**
	 * Get the spans of one trace, in step order. Bounded like GET_LOGS: a trace's span
	 * count is unbounded across turns -- each request caps its own steps, the trace does
	 * not -- so an unlimited SELECT returns a whole conversation's rows in one response.
	 */
	GET_SPANS: (table: string, where: string) => `
		SELECT *
		FROM ${table}
		WHERE ${where}
		ORDER BY span_index ASC
		LIMIT {limit: UInt64}
	`,

	/**
	 * Count runs by date range
	 */
	COUNT_BY_DATE: (table: string) => `
		SELECT ${RUN_COUNT} as total
		FROM ${table}
		WHERE timestamp >= {fromDate: DateTime} AND timestamp <= {toDate: DateTime}
	`,
} as const;
