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
