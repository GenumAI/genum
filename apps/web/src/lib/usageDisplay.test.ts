import { describe, expect, it } from "vitest";
import { formatPricePerMillion, splitLines } from "./usageDisplay";

describe("formatPricePerMillion", () => {
	it("keeps a sub-cent cache price visible", () => {
		expect(formatPricePerMillion(0.005)).toBe("0.005");
		expect(formatPricePerMillion(0.025)).toBe("0.025");
	});

	it("shows a price of a dollar or more to the cent", () => {
		expect(formatPricePerMillion(1.25)).toBe("1.25");
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
