import { describe, it, expect } from "vitest";
import { QUERIES } from "./queries";

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
