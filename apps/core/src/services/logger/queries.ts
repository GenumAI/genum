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
const RUN_COUNT = "countIf(log_type NOT IN ('prt', 'oti'))";

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
	 * Named explicitly rather than `SELECT *` on purpose. Under `SELECT *` a page of ten
	 * carried `in`, `out` and `placeholders` for every row the query touched, which is what
	 * exhausted the query memory limit in production. The payload belongs to
	 * GET_LOG_DETAIL.
	 *
	 * How many rows it touches is decided by the caller, not here: every caller must pin
	 * `project_id` so the filter completes the sorting key (orgId, project_id, timestamp)
	 * and `ORDER BY timestamp DESC LIMIT n` can read in key order instead of sorting the
	 * whole match set.
	 *
	 * `trace_id` is the one agentic column here, and it is here because it is an address,
	 * not a payload: a bounded string that tells the list whether a row has a recorded
	 * trajectory at all. The steps themselves live in `trace_spans` and are read only when
	 * the details dialog opens (GET_SPANS).
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
		trace_id,
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
			countIf(log_lvl = 'SUCCESS' AND log_type NOT IN ('prt', 'oti')) as success_count,
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
	 * Get the spans of one SESSION, in turn order and then step order. A session is one or
	 * more traces -- one per turn -- grouped by `session_id`.
	 *
	 * The disjunction is what makes a row written before the session model readable: those
	 * rows have no `session_id` and their `trace_id` IS the session, which was true of them
	 * when they were written. ClickHouse is append-only here, so they are never rewritten
	 * and this branch is permanent.
	 *
	 * Ordered by TIME first, and by `turn_index` only to break a tie.
	 *
	 * `turn_index` is assigned on arrival from the traces a session already holds, which is
	 * a read followed by a write with nothing serialising the two: two batches of one
	 * session in flight together both read the same list and both take the same ordinal.
	 * Ordering by it alone, those turns interleave, permanently -- the table is
	 * append-only. Time is the one ordering an ingested conversation cannot disagree with,
	 * since the spans carry the sender's own clock; for our own runs every span of a turn
	 * shares one insert timestamp, so `turn_index` then `span_index` still decide the order
	 * within and between turns exactly as before.
	 *
	 * Turns themselves are grouped from `user`-step boundaries, not from this column, so
	 * nothing downstream depends on the ordinal being unique.
	 *
	 * Bounded like GET_LOGS: a session's span count is unbounded across turns -- each
	 * request caps its own steps, the session does not -- so an unlimited SELECT returns a
	 * whole conversation's rows in one response.
	 *
	 * `LIMIT 1 BY (trace_id, span_id)` is the deduplication. OTLP delivers at least once, so
	 * a collector's retry stores the same span a second time and this table cannot be
	 * rewritten to remove it. Keeping one row per span id at read time makes the duplicate
	 * invisible from the moment it lands -- which is also why the table stays a MergeTree:
	 * a ReplacingMergeTree collapses only when it happens to merge, so this clause would be
	 * needed either way. It sits before the row limit, or the limit would cap the rows first
	 * and dedup only what survived.
	 */
	GET_SPANS: (table: string, where: string) => `
		SELECT *
		FROM ${table}
		WHERE ${where}
		  AND (session_id = {session: String}
		       OR (session_id = '' AND trace_id = {session: String}))
		ORDER BY timestamp ASC, turn_index ASC, span_index ASC
		LIMIT 1 BY (trace_id, span_id)
		LIMIT {limit: UInt64}
	`,

	/**
	 * The trace ids already stored for a session, in turn order.
	 *
	 * Ingest reads this before writing: a trace new to the session takes the next ordinal
	 * after these, and one already here keeps the place it has (S5). `turn_index` goes
	 * into an append-only table and can never be renumbered, so this read is what stops a
	 * redelivered turn from being stored a second time under a fresh ordinal.
	 *
	 * `min(timestamp)` orders them the way they were assigned rather than by insertion,
	 * and `GROUP BY` rather than `DISTINCT` because the ordering needs the aggregate.
	 */
	GET_SESSION_TRACE_IDS: (table: string, where: string) => `
		SELECT trace_id
		FROM ${table}
		WHERE ${where}
		  AND (session_id = {session: String}
		       OR (session_id = '' AND trace_id = {session: String}))
		GROUP BY trace_id
		ORDER BY min(turn_index) ASC, min(timestamp) ASC
	`,

	/**
	 * Count runs by date range
	 */
	COUNT_BY_DATE: (table: string) => `
		SELECT ${RUN_COUNT} as total
		FROM ${table}
		WHERE timestamp >= {fromDate: DateTime64(3)} AND timestamp <= {toDate: DateTime64(3)}
	`,
} as const;
