import { describe, it, expect } from "vitest";
import { compareSteps } from "./compare";
import { DEFAULT_STEPS_CONFIG, type Step } from "./types";

const weather = (args: Record<string, unknown>): Step => ({
	kind: "tool_call",
	name: "get_weather",
	args,
});

describe("compareSteps", () => {
	it("passes when an enabled tool call matches exactly", () => {
		const expected: Step[] = [{ ...weather({ city: "Berlin" }), argsMatch: "exact" }];
		expect(compareSteps(expected, [weather({ city: "Berlin" })], DEFAULT_STEPS_CONFIG)).toEqual(
			[],
		);
	});

	it("fails on a changed argument under exact", () => {
		const expected: Step[] = [{ ...weather({ city: "Berlin" }), argsMatch: "exact" }];
		const mismatches = compareSteps(expected, [weather({ city: "Munich" })], DEFAULT_STEPS_CONFIG);
		expect(mismatches).toHaveLength(1);
		expect(mismatches[0].reason).toContain("get_weather");
	});

	it("ignores unlisted keys under subset", () => {
		const expected: Step[] = [{ ...weather({ city: "Berlin" }), argsMatch: "subset" }];
		const actual = [weather({ city: "Berlin", request_id: "abc-123" })];
		expect(compareSteps(expected, actual, DEFAULT_STEPS_CONFIG)).toEqual([]);
	});

	it("still fails under subset when a listed key differs", () => {
		const expected: Step[] = [{ ...weather({ city: "Berlin" }), argsMatch: "subset" }];
		const actual = [weather({ city: "Munich", request_id: "abc-123" })];
		expect(compareSteps(expected, actual, DEFAULT_STEPS_CONFIG)).toHaveLength(1);
	});

	it("accepts any arguments under ignore", () => {
		const expected: Step[] = [{ ...weather({ city: "Berlin" }), argsMatch: "ignore" }];
		expect(compareSteps(expected, [weather({ city: "Munich" })], DEFAULT_STEPS_CONFIG)).toEqual(
			[],
		);
	});

	it("does not assert a disabled step", () => {
		const expected: Step[] = [
			{ ...weather({ city: "Berlin" }), argsMatch: "exact" },
			{ kind: "tool_call", name: "search_docs", enabled: false },
		];
		expect(compareSteps(expected, [weather({ city: "Berlin" })], DEFAULT_STEPS_CONFIG)).toEqual(
			[],
		);
	});

	it("accepts a reordered trajectory when order does not matter", () => {
		const expected: Step[] = [
			{ ...weather({ city: "Berlin" }), argsMatch: "exact" },
			{ kind: "tool_call", name: "get_time", args: { tz: "CET" }, argsMatch: "exact" },
		];
		const actual: Step[] = [
			{ kind: "tool_call", name: "get_time", args: { tz: "CET" } },
			weather({ city: "Berlin" }),
		];
		expect(compareSteps(expected, actual, DEFAULT_STEPS_CONFIG)).toEqual([]);
	});

	it("rejects the same reordering when order matters", () => {
		const expected: Step[] = [
			{ ...weather({ city: "Berlin" }), argsMatch: "exact" },
			{ kind: "tool_call", name: "get_time", args: { tz: "CET" }, argsMatch: "exact" },
		];
		const actual: Step[] = [
			{ kind: "tool_call", name: "get_time", args: { tz: "CET" } },
			weather({ city: "Berlin" }),
		];
		expect(compareSteps(expected, actual, { orderMatters: true })).not.toEqual([]);
	});

	it("reports a tool that was never called", () => {
		const expected: Step[] = [{ ...weather({ city: "Berlin" }), argsMatch: "exact" }];
		const mismatches = compareSteps(expected, [], DEFAULT_STEPS_CONFIG);
		expect(mismatches).toHaveLength(1);
		expect(mismatches[0].reason).toContain("never called");
	});

	it("compares a final step by text", () => {
		const expected: Step[] = [{ kind: "final", text: "It is 12°" }];
		expect(
			compareSteps(expected, [{ kind: "final", text: "It is 12°" }], DEFAULT_STEPS_CONFIG),
		).toEqual([]);
		expect(
			compareSteps(expected, [{ kind: "final", text: "It is 30°" }], DEFAULT_STEPS_CONFIG),
		).toHaveLength(1);
	});
});
