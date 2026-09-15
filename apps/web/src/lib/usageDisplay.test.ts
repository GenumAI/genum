import { describe, expect, it } from "vitest";
import { formatPricePerMillion, logCostSplit, logTokenSplit, splitLines } from "./usageDisplay";
import type { Log } from "@/types/logs";

describe("formatPricePerMillion", () => {
	it("keeps a sub-cent cache price visible", () => {
		expect(formatPricePerMillion(0.005)).toBe("0.005");
		expect(formatPricePerMillion(0.025)).toBe("0.025");
	});

	it("shows a price of a dollar or more to the cent", () => {
		expect(formatPricePerMillion(1.25)).toBe("1.25");
		expect(formatPricePerMillion(2)).toBe("2.00");
	});

	it("trims trailing zeros of a sub-dollar price but never below the cent", () => {
		expect(formatPricePerMillion(0.5)).toBe("0.50");
		expect(formatPricePerMillion(0.3)).toBe("0.30");
		expect(formatPricePerMillion(0.125)).toBe("0.125");
		expect(formatPricePerMillion(0.025)).toBe("0.025");
		expect(formatPricePerMillion(0.005)).toBe("0.005");
		expect(formatPricePerMillion(0.075)).toBe("0.075");
		expect(formatPricePerMillion(0.1)).toBe("0.10");
		expect(formatPricePerMillion(0)).toBe("0.00");
	});
});

describe("splitLines", () => {
	it("keeps only the parts greater than zero, in order", () => {
		expect(
			splitLines([
				{ label: "Cache read", value: 800 },
				{ label: "Cache write", value: 0 },
				{ label: "Reasoning", value: undefined },
				{ label: "Other", value: 5 },
			]),
		).toEqual([
			{ label: "Cache read", value: 800 },
			{ label: "Other", value: 5 },
		]);
	});
});

function log(overrides: Partial<Log> = {}): Log {
	return {
		log_id: "1",
		log_lvl: "SUCCESS",
		timestamp: "2026-09-15T12:00:00Z",
		source: "ui",
		vendor: "OPENAI",
		model: "gpt-4o",
		tokens_sum: 1000,
		cost: 0.01,
		response_ms: 100,
		...overrides,
	};
}

describe("log split", () => {
	it("shows nothing for a row written before the split was recorded", () => {
		expect(logTokenSplit(log())).toEqual([]);
		expect(logCostSplit(log())).toEqual([]);
	});

	it("shows each recorded part, and no line for a zero one", () => {
		const row = log({
			tokens_in_cache_read: 800,
			tokens_in_cache_write: 0,
			tokens_out_reasoning: 40,
			cost_in_cache_read: 0.001,
			cost_in_cache_write: 0,
			cost_out_reasoning: 0.0004,
		});

		expect(logTokenSplit(row)).toEqual([
			{ label: "Cache read", value: 800 },
			{ label: "Reasoning", value: 40 },
		]);
		expect(logCostSplit(row)).toEqual([
			{ label: "Cache read", value: 0.001 },
			{ label: "Reasoning", value: 0.0004 },
		]);
	});
});
