import { describe, it, expect, afterEach, vi } from "vitest";
import { AiVendor } from "@/prisma";
import { getEffectivePrices, withCachePrices } from "./pricing";
import { ALL_MODELS, isDeepSeekPeak } from "./vendors";

/** 2026-08-25 is a Monday; 2026-08-29 a Saturday. */
const MONDAY = "2026-08-25";
const SATURDAY = "2026-08-29";

function at(day: string, time: string) {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(`${day}T${time}Z`));
}

function row(vendor: AiVendor, name: string, promptPrice: number, completionPrice: number) {
	return { vendor, name, promptPrice, completionPrice };
}

describe("DeepSeek time-of-day pricing", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	describe("isDeepSeekPeak", () => {
		it("is peak inside the first weekday window", () => {
			expect(isDeepSeekPeak(new Date(`${MONDAY}T02:30:00Z`))).toBe(true);
		});

		it("is peak inside the second weekday window", () => {
			expect(isDeepSeekPeak(new Date(`${MONDAY}T09:59:00Z`))).toBe(true);
		});

		it("is off-peak in the gap between the two windows", () => {
			expect(isDeepSeekPeak(new Date(`${MONDAY}T05:00:00Z`))).toBe(false);
		});

		it("is off-peak outside both windows", () => {
			expect(isDeepSeekPeak(new Date(`${MONDAY}T18:00:00Z`))).toBe(false);
		});

		it("treats a window's end hour as off-peak", () => {
			expect(isDeepSeekPeak(new Date(`${MONDAY}T04:00:00Z`))).toBe(false);
		});

		it("treats a window's start hour as peak", () => {
			expect(isDeepSeekPeak(new Date(`${MONDAY}T01:00:00Z`))).toBe(true);
		});

		it("is off-peak all weekend, even during a weekday peak window", () => {
			expect(isDeepSeekPeak(new Date(`${SATURDAY}T02:30:00Z`))).toBe(false);
		});
	});

	describe("getEffectivePrices", () => {
		it("bills DeepSeek at the peak rate during a peak window", () => {
			at(MONDAY, "02:30:00");

			expect(getEffectivePrices(row(AiVendor.DEEPSEEK, "deepseek-v4-pro", 1.32, 3.96))).toEqual({
				prompt: 1.32,
				completion: 3.96,
				cacheRead: 0.044,
				cacheWrite: 1.32,
			});
		});

		it("halves DeepSeek prices off-peak, cache hits included", () => {
			at(MONDAY, "18:00:00");

			expect(getEffectivePrices(row(AiVendor.DEEPSEEK, "deepseek-v4-pro", 1.32, 3.96))).toEqual({
				prompt: 0.66,
				completion: 1.98,
				cacheRead: 0.022,
				cacheWrite: 0.66,
			});
			expect(
				getEffectivePrices(row(AiVendor.DEEPSEEK, "deepseek-v4-flash", 0.44, 1.32)),
			).toEqual({ prompt: 0.22, completion: 0.66, cacheRead: 0.22, cacheWrite: 0.22 });
		});

		it("ignores the prices passed in for a model that carries a modifier", () => {
			at(MONDAY, "18:00:00");

			// Stale DB prices must not leak into the bill for a modifier-backed model.
			expect(getEffectivePrices(row(AiVendor.DEEPSEEK, "deepseek-v4-flash", 99, 99))).toEqual({
				prompt: 0.22,
				completion: 0.66,
				cacheRead: 0.22,
				cacheWrite: 0.22,
			});
		});
	});

	describe("getEffectivePrices for flat-priced models", () => {
		it("takes base prices from the row and the cache read price from the registry", () => {
			expect(getEffectivePrices(row(AiVendor.OPENAI, "gpt-4o", 2.5, 10))).toEqual({
				prompt: 2.5,
				completion: 10,
				cacheRead: 1.25,
				cacheWrite: 2.5,
			});
		});

		it("takes Anthropic's cache write price from the registry", () => {
			expect(getEffectivePrices(row(AiVendor.ANTHROPIC, "claude-sonnet-4-5", 3, 15))).toEqual({
				prompt: 3,
				completion: 15,
				cacheRead: 0.3,
				cacheWrite: 3.75,
			});
		});

		it("bills cache tokens at the prompt price where the vendor publishes no cache price", () => {
			expect(getEffectivePrices(row(AiVendor.OPENAI, "o3-pro", 20, 80))).toEqual({
				prompt: 20,
				completion: 80,
				cacheRead: 20,
				cacheWrite: 20,
			});
		});

		it("falls back to the row's prices for a model absent from the registry", () => {
			expect(
				getEffectivePrices(row(AiVendor.CUSTOM_OPENAI_COMPATIBLE, "some-custom-model", 1, 2)),
			).toEqual({ prompt: 1, completion: 2, cacheRead: 1, cacheWrite: 1 });
		});

		it("does not match a model name belonging to a different vendor", () => {
			expect(getEffectivePrices(row(AiVendor.ANTHROPIC, "deepseek-v4-flash", 7, 8))).toEqual({
				prompt: 7,
				completion: 8,
				cacheRead: 7,
				cacheWrite: 7,
			});
		});
	});
});

describe("registry cache prices", () => {
	it("lists every cache read below its own model's prompt price", () => {
		for (const model of ALL_MODELS) {
			if (model.cacheReadPrice !== undefined) {
				expect(model.cacheReadPrice, model.name).toBeLessThan(model.promptPrice);
			}
		}
	});

	it("lists every cache write at or above its own model's prompt price", () => {
		for (const model of ALL_MODELS) {
			if (model.cacheWritePrice !== undefined) {
				expect(model.cacheWritePrice, model.name).toBeGreaterThanOrEqual(model.promptPrice);
			}
		}
	});
});

describe("withCachePrices", () => {
	it("attaches the registry's cache prices and keeps every other field", () => {
		expect(withCachePrices({ id: 7, vendor: AiVendor.OPENAI, name: "gpt-4o" })).toEqual({
			id: 7,
			vendor: AiVendor.OPENAI,
			name: "gpt-4o",
			cacheReadPrice: 1.25,
			cacheWritePrice: null,
		});
	});

	it("attaches null, never zero, for a model absent from the registry", () => {
		expect(
			withCachePrices({ vendor: AiVendor.CUSTOM_OPENAI_COMPATIBLE, name: "some-custom-model" }),
		).toMatchObject({ cacheReadPrice: null, cacheWritePrice: null });
	});
});
