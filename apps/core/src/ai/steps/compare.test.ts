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

	// Finding (a): object key order should not matter
	it("ignores object key order in exact mode", () => {
		const expected: Step[] = [
			{
				...weather({ city: "Berlin", unit: "C" }),
				argsMatch: "exact",
			},
		];
		const actual: Step[] = [
			{
				kind: "tool_call",
				name: "get_weather",
				args: { unit: "C", city: "Berlin" },
			},
		];
		expect(compareSteps(expected, actual, DEFAULT_STEPS_CONFIG)).toEqual([]);
	});

	it("ignores nested object key order in exact mode", () => {
		const expected: Step[] = [
			{
				kind: "tool_call",
				name: "get_weather",
				args: { location: { city: "Berlin", country: "DE" } },
				argsMatch: "exact",
			},
		];
		const actual: Step[] = [
			{
				kind: "tool_call",
				name: "get_weather",
				args: { location: { country: "DE", city: "Berlin" } },
			},
		];
		expect(compareSteps(expected, actual, DEFAULT_STEPS_CONFIG)).toEqual([]);
	});

	it("detects reordered array elements as different", () => {
		const expected: Step[] = [
			{
				kind: "tool_call",
				name: "list_items",
				args: { items: ["a", "b", "c"] },
				argsMatch: "exact",
			},
		];
		const actual: Step[] = [
			{
				kind: "tool_call",
				name: "list_items",
				args: { items: ["c", "b", "a"] },
			},
		];
		const mismatches = compareSteps(expected, actual, DEFAULT_STEPS_CONFIG);
		expect(mismatches).toHaveLength(1);
	});

	// Finding (b): greedy matching can fail when two expected steps could match the same actual
	it("correctly matches when two expected steps call the same tool", () => {
		const expected: Step[] = [
			{ ...weather({ city: "Berlin" }), argsMatch: "exact" },
			{ ...weather({ city: "Paris" }), argsMatch: "exact" },
		];
		const actual: Step[] = [
			weather({ city: "Paris" }),
			weather({ city: "Berlin" }),
		];
		// Greedy would pick Paris for the first, then fail on Berlin.
		// Backtracking should succeed.
		expect(compareSteps(expected, actual, DEFAULT_STEPS_CONFIG)).toEqual([]);
	});

	// Finding (c): orderMatters with disabled steps
	it("respects relative order of enabled steps with disabled step in the middle", () => {
		const expected: Step[] = [
			{ ...weather({ city: "Berlin" }), argsMatch: "exact" },
			{ kind: "tool_call", name: "search_docs", enabled: false },
			{ kind: "tool_call", name: "get_time", args: { tz: "CET" }, argsMatch: "exact" },
		];
		const actual: Step[] = [
			weather({ city: "Berlin" }),
			{ kind: "tool_call", name: "get_time", args: { tz: "CET" } },
		];
		// The enabled steps (get_weather, get_time) appear in order in actual,
		// and the disabled step should not consume a position.
		expect(compareSteps(expected, actual, { orderMatters: true })).toEqual([]);
	});

	it("rejects enabled steps out of order even with a disabled step in between", () => {
		const expected: Step[] = [
			{ ...weather({ city: "Berlin" }), argsMatch: "exact" },
			{ kind: "tool_call", name: "search_docs", enabled: false },
			{ kind: "tool_call", name: "get_time", args: { tz: "CET" }, argsMatch: "exact" },
		];
		const actual: Step[] = [
			{ kind: "tool_call", name: "get_time", args: { tz: "CET" } },
			weather({ city: "Berlin" }),
		];
		// The enabled steps are out of order (get_time before get_weather),
		// so this should fail. get_weather is found at position 1, then we look for
		// get_time from position 2 onwards and don't find it.
		const mismatches = compareSteps(expected, actual, { orderMatters: true });
		expect(mismatches).toHaveLength(1);
		expect(mismatches[0].index).toBe(2);
	});
});
