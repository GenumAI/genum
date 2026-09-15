import { describe, it, expect } from "vitest";
import { QUERIES } from "./queries";
import type { LogUsage } from "./types";
import { sumUsage, ZERO_USAGE } from "./usage";

const FIELDS = Object.keys(ZERO_USAGE) as (keyof LogUsage)[];

/**
 * Distinct and non-zero for every field and every turn, so a field copied from one turn
 * instead of summed can never equal the expected sum.
 */
function turn(seed: number): LogUsage {
	const usage: LogUsage = { ...ZERO_USAGE };
	FIELDS.forEach((field, index) => {
		usage[field] = seed * (index + 1);
	});
	return usage;
}

describe("sumUsage", () => {
	it("sums every usage field across the turns", () => {
		const total = sumUsage([turn(1), turn(10), turn(100)]);

		FIELDS.forEach((field, index) => {
			expect(total[field], field).toBe(111 * (index + 1));
		});
	});

	it("is zero usage for no turns", () => {
		expect(sumUsage([])).toEqual(ZERO_USAGE);
	});
});

describe("LOG_LIST_COLUMNS", () => {
	// Its type cannot catch this: a field in the row type but not in the query is `undefined`
	// at runtime, not a type error (see ClickHouseLogListRow).
	it("names every usage field", () => {
		for (const field of FIELDS) {
			expect(QUERIES.LOG_LIST_COLUMNS).toMatch(new RegExp(`\\b${field}\\b`));
		}
	});
});
