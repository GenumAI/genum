import { describe, it, expect } from "vitest";
import { calculateCost, type TokenUsage } from ".";

const PRICES = { prompt: 2, completion: 8, cacheRead: 0.5, cacheWrite: 2.5 };

function usage(overrides: Partial<TokenUsage> = {}): TokenUsage {
	return {
		prompt: 0,
		completion: 0,
		total: 0,
		cacheRead: 0,
		cacheWrite: 0,
		reasoning: 0,
		...overrides,
	};
}

describe("calculateCost", () => {
	it("bills cached input at the cache price and only the rest at the prompt price", () => {
		const cost = calculateCost(usage({ prompt: 1_000_000, cacheRead: 800_000 }), PRICES);

		expect(cost.cacheRead).toBeCloseTo(0.4);
		// 200k × $2 + 800k × $0.50
		expect(cost.prompt).toBeCloseTo(0.8);
	});

	it("bills cache writes at the cache write price", () => {
		const cost = calculateCost(usage({ prompt: 1_000_000, cacheWrite: 1_000_000 }), PRICES);

		expect(cost.cacheWrite).toBeCloseTo(2.5);
		expect(cost.prompt).toBeCloseTo(2.5);
	});

	it("reports reasoning as a share of completion, never on top of it", () => {
		const cost = calculateCost(usage({ completion: 1_000_000, reasoning: 750_000 }), PRICES);

		expect(cost.completion).toBeCloseTo(8);
		expect(cost.reasoning).toBeCloseTo(6);
		expect(cost.total).toBeCloseTo(8);
	});

	it("totals prompt and completion", () => {
		const cost = calculateCost(
			usage({ prompt: 500_000, cacheRead: 100_000, completion: 250_000 }),
			PRICES,
		);

		// 400k × $2 + 100k × $0.50 + 250k × $8
		expect(cost.total).toBeCloseTo(0.8 + 0.05 + 2);
		expect(cost.total).toBeCloseTo(cost.prompt + cost.completion);
	});

	it("never goes negative when a vendor reports more cache tokens than input tokens", () => {
		const cost = calculateCost(usage({ prompt: 100, cacheRead: 500 }), PRICES);

		expect(cost.prompt).toBeGreaterThanOrEqual(0);
		expect(cost.prompt).toBeCloseTo(cost.cacheRead);
	});
});
