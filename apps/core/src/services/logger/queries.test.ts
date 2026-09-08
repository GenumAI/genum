import { describe, it, expect } from "vitest";
import { QUERIES, QUOTE_64BIT_INTEGERS } from "./queries";
import { WhereBuilder } from "./where.builder";
import type { ClickHouseLogListRow } from "./types";

/**
 * A complete list row. Typed, so adding a field to `ClickHouseLogListRow` fails to compile
 * until it is added here -- which is what makes the column test below a closed world
 * rather than a spot check.
 */
const LIST_ROW: ClickHouseLogListRow = {
	log_id: "15725040608634065115",
	timestamp: "2026-09-07 15:41:25.368",
	source: "api",
	log_lvl: "SUCCESS",
	log_type: "prs",
	description: null,
	orgId: 4,
	project_id: 4,
	prompt_id: 1400,
	user_id: 7,
	api_key_id: null,
	testcase_id: null,
	trace_id: null,
	vendor: "openai",
	model: "gpt-5",
	tokens_in: 11,
	tokens_out: 22,
	tokens_sum: 33,
	cost: 0.0025,
	response_ms: 1500,
};

describe("GET_LOGS", () => {
	const sql = QUERIES.GET_LOGS("logs", "orgId = {param_0: Int64}");

	it("names every column the list row declares", () => {
		for (const column of Object.keys(LIST_ROW)) {
			expect(sql).toContain(column);
		}
	});

	it("never selects the payload columns", () => {
		// The defect this guards: `SELECT *` dragged `in`, `out` and `placeholders` through
		// a scan of every matching row to return a page of ten, and ClickHouse refused the
		// allocation. A list must stay payload-free however the column set grows.
		expect(sql).not.toContain("*");
		expect(sql).not.toMatch(/\bplaceholders\b/);
		expect(sql).not.toMatch(/`in`|`out`/);
	});

	it("still paginates", () => {
		expect(sql).toContain("ORDER BY timestamp DESC");
		expect(sql).toContain("LIMIT {limit: UInt64} OFFSET {offset: UInt64}");
	});
});

describe("GET_LOG_DETAIL", () => {
	const sql = QUERIES.GET_LOG_DETAIL("logs", "log_id = {param_0: UInt64}");

	it("selects the payload the list refuses to carry", () => {
		expect(sql).toContain("`in`");
		expect(sql).toContain("`out`");
		expect(sql).toContain("placeholders");
		// `memory_key` is frozen, but legacy rows still resolve their placeholders from it.
		expect(sql).toContain("memory_key");
	});

	it("reads a single row", () => {
		expect(sql).toContain("LIMIT 1");
	});
});

describe("QUOTE_64BIT_INTEGERS", () => {
	it("asks the server to quote UInt64, because JSON.parse cannot hold one", () => {
		expect(QUOTE_64BIT_INTEGERS).toEqual({ output_format_json_quote_64bit_integers: 1 });
	});
});

describe("WhereBuilder.dateRange", () => {
	it("keeps the instant the UI asked for instead of widening it to whole days", () => {
		// A UTC+2 user picking 24 Aug - 8 Sep sends these. Truncating them to `YYYY-MM-DD`
		// and padding with 00:00:00 / 23:59:59 did not just widen the window, it moved it:
		// 23 Aug came in at the bottom and the tail of 7 Sep fell off.
		const { where, params } = WhereBuilder.forOrg(4)
			.dateRange(new Date("2026-08-23T22:00:00.000Z"), new Date("2026-09-07T21:59:59.999Z"))
			.build();

		expect(where).toContain("timestamp >= {param_1: DateTime64(3)}");
		expect(where).toContain("timestamp <= {param_2: DateTime64(3)}");
		expect(params.param_1).toBe("2026-08-23 22:00:00.000");
		expect(params.param_2).toBe("2026-09-07 21:59:59.999");
	});

	it("adds nothing for an absent bound", () => {
		expect(WhereBuilder.forOrg(4).dateRange(undefined, undefined).build().where).toBe(
			"orgId = {param_0: Int64}",
		);
	});
});

describe("WhereBuilder detail conditions", () => {
	it("pins an exact timestamp so the lookup prunes to one monthly partition", () => {
		const { where, params } = WhereBuilder.forOrg(4)
			.timestampExact("2026-09-07 15:41:25.368")
			.build();

		expect(where).toContain("timestamp = {param_1: DateTime64(3)}");
		expect(params.param_1).toBe("2026-09-07 15:41:25.368");
	});

	it("keeps log_id a string, because a UInt64 does not survive a double", () => {
		const logId = "15725040608634065115";
		const { where, params } = WhereBuilder.forOrg(4).logId(logId).build();

		expect(where).toContain("log_id = {param_1: UInt64}");
		expect(params.param_1).toBe(logId);
		// The round trip that rounding would break.
		expect(String(Number(logId))).not.toBe(logId);
	});
});

/**
 * `prt` rows are continuation turns of one run, not runs of their own (see the comment
 * above `RUN_COUNT` in queries.ts). Every query that reports "how many runs" must exclude
 * them via `countIf(log_type != 'prt')`; every query that sums cost or tokens must NOT,
 * because a continuation turn is still a real, billed provider call. This file pins that
 * distinction at each of the nine counting positions individually, so that a tenth stats
 * query added later without the guard is a visible, named omission rather than a query
 * that silently starts overcounting runs.
 */
const RUN_COUNT_EXPR = "countIf(log_type != 'prt')";

describe("QUERIES run-counting positions exclude 'prt' rows", () => {
	it("PROJECT_STATS.total_requests", () => {
		const sql = QUERIES.PROJECT_STATS("logs", "1=1");
		expect(sql).toContain(`${RUN_COUNT_EXPR} as total_requests`);
	});

	it("PROMPT_STATS.total_requests", () => {
		const sql = QUERIES.PROMPT_STATS("logs", "1=1");
		expect(sql).toContain(`${RUN_COUNT_EXPR} as total_requests`);
	});

	it("MODEL_STATS.total_requests", () => {
		const sql = QUERIES.MODEL_STATS("logs", "1=1");
		expect(sql).toContain(`${RUN_COUNT_EXPR} as total_requests`);
	});

	it("USER_STATS.total_requests", () => {
		const sql = QUERIES.USER_STATS("logs", "1=1");
		expect(sql).toContain(`${RUN_COUNT_EXPR} as total_requests`);
	});

	it("API_KEY_STATS.total_requests", () => {
		const sql = QUERIES.API_KEY_STATS("logs", "1=1");
		expect(sql).toContain(`${RUN_COUNT_EXPR} as total_requests`);
	});

	it("PROJECT_DAILY_STATS.total_requests", () => {
		const sql = QUERIES.PROJECT_DAILY_STATS("logs", "1=1");
		expect(sql).toContain(`${RUN_COUNT_EXPR} as total_requests`);
	});

	it("ORGANIZATION_DAILY_STATS.total_requests (the daily rollup total)", () => {
		const sql = QUERIES.ORGANIZATION_DAILY_STATS("logs", "1=1");
		expect(sql).toContain(`${RUN_COUNT_EXPR} as total_requests`);
	});

	it("ORGANIZATION_DAILY_STATS.requests (the per-breakdown-row count)", () => {
		const sql = QUERIES.ORGANIZATION_DAILY_STATS("logs", "1=1");
		expect(sql).toContain(`${RUN_COUNT_EXPR} as requests`);
	});

	it("COUNT_BY_DATE.total", () => {
		const sql = QUERIES.COUNT_BY_DATE("logs");
		expect(sql).toContain(`${RUN_COUNT_EXPR} as total`);
	});
});

describe("QUERIES.COUNT deliberately does NOT exclude 'prt' rows", () => {
	// QUERIES.COUNT is the pagination total for GET_LOGS, the raw log listing -- GET_LOGS
	// returns every row matching the WHERE clause, `prt` rows included, so its total must
	// count the same rows or pagination goes wrong (a total that undercounts what the
	// listing actually returns). This assertion is written to fail if someone "fixes"
	// COUNT by adding the run-count guard to it -- that would be the listing's total
	// silently falling out of step with what GET_LOGS actually returns.
	it("counts every matching row, including 'prt' rows", () => {
		const sql = QUERIES.COUNT("logs", "1=1");
		expect(sql).not.toContain("log_type != 'prt'");
		expect(sql).toMatch(/count\(\)\s+as total/);
	});
});

describe("success_count carries the same 'prt' exclusion as total_requests", () => {
	// success_rate = success_count / total_requests. If success_count counted 'prt' rows
	// while total_requests did not, a prompt with continuation turns could show a success
	// rate above 100%.
	it("PROMPT_STATS.success_count excludes 'prt' rows alongside log_lvl = 'SUCCESS'", () => {
		const sql = QUERIES.PROMPT_STATS("logs", "1=1");
		expect(sql).toMatch(/countIf\(log_lvl = 'SUCCESS' AND log_type != 'prt'\)\s+as success_count/);
	});
});

describe("cost and token sums are NOT filtered by log_type", () => {
	// A continuation turn ('prt') is a real, separately billed provider call: its tokens
	// and cost must land in every sum, even though it must not be counted as its own run.
	// This is the entire reason RUN_COUNT is a `countIf` fragment substituted into a
	// `SELECT`, rather than a `WHERE log_type != 'prt'` on the whole query -- a WHERE
	// clause would also suppress these sums, which is exactly the bug this pins against.
	it("PROJECT_STATS sums tokens and cost unconditionally", () => {
		const sql = QUERIES.PROJECT_STATS("logs", "1=1");
		expect(sql).toMatch(/sum\(tokens_in\)\s+as total_tokens_in/);
		expect(sql).toMatch(/sum\(tokens_out\)\s+as total_tokens_out/);
		expect(sql).toMatch(/sum\(tokens_sum\)\s+as total_tokens_sum/);
		expect(sql).toMatch(/sum\(cost\)\s+as total_cost/);
		expect(sql).not.toMatch(/sumIf/);
	});

	it("PROMPT_STATS sums tokens and cost unconditionally", () => {
		const sql = QUERIES.PROMPT_STATS("logs", "1=1");
		expect(sql).toMatch(/sum\(tokens_in\)\s+as total_tokens_in/);
		expect(sql).toMatch(/sum\(tokens_out\)\s+as total_tokens_out/);
		expect(sql).toMatch(/sum\(tokens_sum\)\s+as total_tokens_sum/);
		expect(sql).toMatch(/sum\(cost\)\s+as total_cost/);
		expect(sql).not.toMatch(/sumIf/);
	});

	it("MODEL_STATS sums tokens and cost unconditionally", () => {
		const sql = QUERIES.MODEL_STATS("logs", "1=1");
		expect(sql).toMatch(/sum\(tokens_in\)\s+as total_tokens_in/);
		expect(sql).toMatch(/sum\(tokens_out\)\s+as total_tokens_out/);
		expect(sql).toMatch(/sum\(tokens_sum\)\s+as total_tokens_sum/);
		expect(sql).toMatch(/sum\(cost\)\s+as total_cost/);
		expect(sql).not.toMatch(/sumIf/);
	});

	it("USER_STATS sums tokens and cost unconditionally", () => {
		const sql = QUERIES.USER_STATS("logs", "1=1");
		expect(sql).toMatch(/sum\(tokens_sum\)\s+as total_tokens_sum/);
		expect(sql).toMatch(/sum\(cost\)\s+as total_cost/);
		expect(sql).not.toMatch(/sumIf/);
	});

	it("API_KEY_STATS sums tokens and cost unconditionally", () => {
		const sql = QUERIES.API_KEY_STATS("logs", "1=1");
		expect(sql).toMatch(/sum\(tokens_sum\)\s+as total_tokens_sum/);
		expect(sql).toMatch(/sum\(cost\)\s+as total_cost/);
		expect(sql).not.toMatch(/sumIf/);
	});

	it("PROJECT_DAILY_STATS sums tokens and cost unconditionally", () => {
		const sql = QUERIES.PROJECT_DAILY_STATS("logs", "1=1");
		expect(sql).toMatch(/sum\(tokens_sum\)\s+as total_tokens_sum/);
		expect(sql).toMatch(/sum\(cost\)\s+as total_cost/);
		expect(sql).not.toMatch(/sumIf/);
	});

	it("ORGANIZATION_DAILY_STATS sums tokens and cost unconditionally, in both its rollup and breakdown columns", () => {
		const sql = QUERIES.ORGANIZATION_DAILY_STATS("logs", "1=1");
		expect(sql).toMatch(/sum\(tokens_sum\)\s+as total_tokens/);
		expect(sql).toMatch(/sum\(cost\)\s+as total_cost/);
		expect(sql).toMatch(/sum\(tokens_sum\)\s+as tokens/);
		expect(sql).toMatch(/sum\(cost\)\s+as cost/);
		expect(sql).not.toMatch(/sumIf/);
	});
});
