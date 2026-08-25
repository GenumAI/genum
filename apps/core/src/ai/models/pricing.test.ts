import { describe, it, expect, afterEach, vi } from "vitest";
import { AiVendor } from "@/prisma";
import { getEffectivePrices } from "./pricing";
import { isDeepSeekPeak } from "./vendors/deepseek";

/** 2026-08-25 is a Monday; 2026-08-29 a Saturday. */
const MONDAY = "2026-08-25";
const SATURDAY = "2026-08-29";

function at(day: string, time: string) {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(`${day}T${time}Z`));
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

			expect(getEffectivePrices(AiVendor.DEEPSEEK, "deepseek-v4-flash", 0.44, 1.32)).toEqual({
				prompt: 0.44,
				completion: 1.32,
			});
		});

		it("halves DeepSeek prices off-peak", () => {
			at(MONDAY, "18:00:00");

			expect(getEffectivePrices(AiVendor.DEEPSEEK, "deepseek-v4-flash", 0.44, 1.32)).toEqual({
				prompt: 0.22,
				completion: 0.66,
			});
			expect(getEffectivePrices(AiVendor.DEEPSEEK, "deepseek-v4-pro", 1.32, 3.96)).toEqual({
				prompt: 0.66,
				completion: 1.98,
			});
		});

		it("ignores the prices passed in for a model that carries a modifier", () => {
			at(MONDAY, "18:00:00");

			// Stale DB prices must not leak into the bill for a modifier-backed model.
			expect(getEffectivePrices(AiVendor.DEEPSEEK, "deepseek-v4-flash", 99, 99)).toEqual({
				prompt: 0.22,
				completion: 0.66,
			});
		});
	});

	describe("getEffectivePrices for flat-priced models", () => {
		it("returns the model's own prices for a vendor without a modifier", () => {
			at(MONDAY, "18:00:00");

			expect(getEffectivePrices(AiVendor.OPENAI, "gpt-4o", 2.5, 10)).toEqual({
				prompt: 2.5,
				completion: 10,
			});
		});

		it("falls back to the prices passed in for a model absent from the registry", () => {
			expect(
				getEffectivePrices(AiVendor.CUSTOM_OPENAI_COMPATIBLE, "some-custom-model", 1, 2),
			).toEqual({ prompt: 1, completion: 2 });
		});

		it("does not match a model name belonging to a different vendor", () => {
			expect(getEffectivePrices(AiVendor.ANTHROPIC, "deepseek-v4-flash", 7, 8)).toEqual({
				prompt: 7,
				completion: 8,
			});
		});
	});
});
