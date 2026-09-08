/**
 * SQL Queries for ClickHouse Logger
 * All queries use parameterized WHERE clauses for SQL injection protection
 */

/**
 * Send this with any query that selects `log_id`.
 *
 * `@clickhouse/client` turns JSONEachRow into objects with `JSON.parse`, and it ships with
 * `output_format_json_quote_64bit_integers` OFF -- so an unquoted `UInt64` arrives as a
 * double and silently loses its low digits: 15725040608634065115 comes back as
 * ...065000, and every detail lookup built from it addresses a row that does not exist.
 * Quoting on the server is the only place this can be fixed; `String(row.log_id)` in
 * TypeScript runs after the damage.
 */
export const QUOTE_64BIT_INTEGERS = { output_format_json_quote_64bit_integers: 1 } as const;

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
	 * Every column a log LIST needs, and no more.
	 *
	 * Named explicitly rather than `SELECT *` on purpose. `ORDER BY timestamp DESC LIMIT n`
	 * cannot read in sorting-key order here -- the key is (orgId, project_id, timestamp)
	 * and the prompt-logs filter leaves `project_id` free -- so ClickHouse reads every
	 * matching row and sorts. Under `SELECT *` that carried `in`, `out` and `placeholders`
	 * for the whole scan to return ten rows, which is what exhausted the query memory
	 * limit in production. The payload belongs to GET_LOG_DETAIL.
	 *
	 * Both this and GET_LOG_DETAIL must be sent with QUOTE_64BIT_INTEGERS -- see there.
	 */
	LOG_LIST_COLUMNS: `
		log_id,
		timestamp,
		source,
		log_lvl,
		log_type,
		description,
		orgId,
		project_id,
		prompt_id,
		user_id,
		api_key_id,
		testcase_id,
		vendor,
		model,
		tokens_in,
		tokens_out,
		tokens_sum,
		cost,
		response_ms
	`,

	/**
	 * Get logs with pagination
	 */
	GET_LOGS: (table: string, where: string) => `
		SELECT ${QUERIES.LOG_LIST_COLUMNS}
		FROM ${table}
		WHERE ${where}
		ORDER BY timestamp DESC
		LIMIT {limit: UInt64} OFFSET {offset: UInt64}
	`,

	/**
	 * The payload of a single row, for the details dialog.
	 *
	 * `where` always pins an exact `timestamp`, which prunes to the one monthly partition
	 * (`PARTITION BY toYYYYMM(timestamp)`) before `log_id` picks the row out of it. Without
	 * that predicate this would scan the organisation: `log_id` is materialised, not part
	 * of any index.
	 *
	 * `LIMIT 1` because `log_id` is a hash, not an enforced key -- two rows agreeing on all
	 * fourteen hashed fields including the millisecond are indistinguishable here anyway.
	 */
	GET_LOG_DETAIL: (table: string, where: string) => `
		SELECT log_id, \`in\`, \`out\`, memory_key, placeholders
		FROM ${table}
		WHERE ${where}
		LIMIT 1
	`,

	/**
	 * Get project-level statistics
	 */
	PROJECT_STATS: (table: string, where: string) => `
		SELECT
			count() as total_requests,
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
			count() as total_requests,
			sum(tokens_in) as total_tokens_in,
			sum(tokens_out) as total_tokens_out,
			sum(tokens_sum) as total_tokens_sum,
			avg(response_ms) as average_response_ms,
			sum(cost) as total_cost,
			countIf(log_lvl = 'SUCCESS') as success_count,
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
			count() as total_requests,
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
			count() as total_requests,
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
			count() as total_requests,
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
			count() as total_requests,
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
			count() as total_requests,
			sum(tokens_sum) as total_tokens,
			sum(cost) as total_cost,
			project_id,
			source,
			vendor,
			model,
			count() as requests,
			sum(tokens_sum) as tokens,
			sum(cost) as cost
		FROM ${table}
		WHERE ${where}
		GROUP BY date, project_id, source, vendor, model
		ORDER BY date
	`,

	/**
	 * Count runs by date range
	 */
	COUNT_BY_DATE: (table: string) => `
		SELECT count() as total
		FROM ${table}
		WHERE timestamp >= {fromDate: DateTime} AND timestamp <= {toDate: DateTime}
	`,
} as const;
