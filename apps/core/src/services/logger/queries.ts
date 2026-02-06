/**
 * SQL Queries for ClickHouse Logger
 * All queries use parameterized WHERE clauses for SQL injection protection
 */

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
