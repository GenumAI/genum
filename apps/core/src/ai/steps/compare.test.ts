import { describe, it, expect } from "vitest";
import { compareSteps } from "./compare";
import { DEFAULT_STEPS_CONFIG, type Step, type ToolCallStep } from "./types";

const weather = (args: Record<string, unknown>): ToolCallStep => ({
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
	it("resolves ambiguity between loose and strict matchers competing for same actual step", () => {
		const expected: Step[] = [
			{
				kind: "tool_call",
				name: "search",
				argsMatch: "ignore",
			},
			{
				kind: "tool_call",
				name: "search",
				args: { q: "cats" },
				argsMatch: "exact",
			},
		];
		const actual: Step[] = [
			{ kind: "tool_call", name: "search", args: { q: "cats" } },
			{ kind: "tool_call", name: "search", args: { q: "dogs" } },
		];
		// A first-come-first-served match is wrong here: expected[0] (ignore) would take
		// actual[0], leaving expected[1] (exact, {q:"cats"}) to fail against {q:"dogs"}.
		// Maximum matching seats both -- expected[1] displaces expected[0] onto actual[1]
		// along an augmenting path -- so a permissive step never starves a strict one.
		expect(compareSteps(expected, actual, DEFAULT_STEPS_CONFIG)).toEqual([]);
	});

	// Thirteen pinned calls against one actual call: above the old backtracking cap the
	// greedy fallback matched one and then re-derived "found" by re-testing every expected
	// step against ANY consumed index, so all thirteen were reported as passing. A pinned
	// trajectory that can never fail is the exact defect this feature exists to prevent.
	it("does not pass thirteen pinned calls against a single actual call", () => {
		const expected: Step[] = Array.from({ length: 13 }, () => ({
			kind: "tool_call" as const,
			name: "search",
			args: { q: "cats" },
			argsMatch: "exact" as const,
		}));
		const actual: Step[] = [{ kind: "tool_call", name: "search", args: { q: "cats" } }];

		const mismatches = compareSteps(expected, actual, DEFAULT_STEPS_CONFIG);
		// One expected step is genuinely satisfied; the other twelve are not.
		expect(mismatches).toHaveLength(12);
	});

	// A real assignment is in hand, so only the steps left unmatched are reported. Before,
	// a single impossible step made every enabled step read as mismatched, which buries the
	// one thing that actually changed.
	it("reports only the genuinely unmatched steps when no full assignment exists", () => {
		const expected: Step[] = [
			{ ...weather({ city: "Berlin" }), argsMatch: "exact" },
			{ kind: "tool_call", name: "get_time", args: { tz: "CET" }, argsMatch: "exact" },
			{ kind: "final", text: "It is 12°" },
		];
		const actual: Step[] = [
			weather({ city: "Berlin" }),
			{ kind: "final", text: "It is 12°" },
		];

		const mismatches = compareSteps(expected, actual, DEFAULT_STEPS_CONFIG);
		expect(mismatches).toHaveLength(1);
		expect(mismatches[0].index).toBe(1);
		expect(mismatches[0].reason).toContain("get_time");
	});

	// The same ambiguity as finding (b), but above the old 12-step cap: the resolution must
	// not depend on how many steps the author happened to pin.
	it("resolves competing matchers above the old greedy threshold", () => {
		const expected: Step[] = [
			{ kind: "tool_call", name: "search", argsMatch: "ignore" },
			{ kind: "tool_call", name: "search", args: { q: "cats" }, argsMatch: "exact" },
			...Array.from({ length: 11 }, (_, i) => ({
				kind: "tool_call" as const,
				name: `tool_${i}`,
				argsMatch: "ignore" as const,
			})),
		];
		const actual: Step[] = [
			{ kind: "tool_call", name: "search", args: { q: "cats" } },
			{ kind: "tool_call", name: "search", args: { q: "dogs" } },
			...Array.from({ length: 11 }, (_, i) => ({
				kind: "tool_call" as const,
				name: `tool_${i}`,
				args: {},
			})),
		];
		expect(compareSteps(expected, actual, DEFAULT_STEPS_CONFIG)).toEqual([]);
	});

	// The final step must not be asserted more strictly than the STRICT text assertion it
	// replaces: both run through `normalize`, so trailing whitespace and case do not fail a
	// testcase converted from text to trajectory.
	it("normalizes the final answer the way the text assertion does", () => {
		const expected: Step[] = [{ kind: "final", text: "It is 12°" }];
		expect(
			compareSteps(expected, [{ kind: "final", text: "  it is 12°  " }], DEFAULT_STEPS_CONFIG),
		).toEqual([]);
	});

	it("still fails a final answer that genuinely differs", () => {
		const expected: Step[] = [{ kind: "final", text: "It is 12°" }];
		expect(
			compareSteps(expected, [{ kind: "final", text: "It is 30°" }], DEFAULT_STEPS_CONFIG),
		).toHaveLength(1);
	});

	it("compares a JSON final answer by sorted keys, as the text assertion does", () => {
		const expected: Step[] = [{ kind: "final", text: '{"b":2,"a":1}' }];
		expect(
			compareSteps(expected, [{ kind: "final", text: '{"a":1,"b":2}' }], DEFAULT_STEPS_CONFIG),
		).toEqual([]);
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

	it("does not let a call from one turn satisfy an expectation from another", () => {
		// The case the whole decision rests on. Pinned: turn 1 asks Paris, turn 2 asks
		// London. A regressed agent swaps them and answers the wrong city in both turns.
		// Flat matching over the whole session sees the same multiset and passes green.
		const expected: Step[] = [
			{ kind: "tool_call", name: "get_weather", args: { city: "Paris" } },
			{ kind: "final", text: "21 in Paris" },
			{ kind: "user", text: "and in London?" },
			{ kind: "tool_call", name: "get_weather", args: { city: "London" } },
			{ kind: "final", text: "14 in London" },
		];
		const actual: Step[] = [
			{ kind: "tool_call", name: "get_weather", args: { city: "London" } },
			{ kind: "final", text: "21 in Paris" },
			{ kind: "user", text: "and in London?" },
			{ kind: "tool_call", name: "get_weather", args: { city: "Paris" } },
			{ kind: "final", text: "14 in London" },
		];

		const mismatches = compareSteps(expected, actual, { orderMatters: false });

		expect(mismatches).toHaveLength(2);
		// Flat indices into `expected`, so the panel can point at the pinned step.
		expect(mismatches.map((m) => m.index).sort()).toEqual([0, 3]);
	});

	it("still ignores order inside a turn", () => {
		const expected: Step[] = [
			{ kind: "tool_call", name: "a" },
			{ kind: "tool_call", name: "b" },
			{ kind: "final", text: "done" },
		];
		const actual: Step[] = [
			{ kind: "tool_call", name: "b" },
			{ kind: "tool_call", name: "a" },
			{ kind: "final", text: "done" },
		];
		expect(compareSteps(expected, actual, { orderMatters: false })).toEqual([]);
	});

	it("reports a turn the run never reached as mismatched, not as passed", () => {
		const expected: Step[] = [
			{ kind: "tool_call", name: "a" },
			{ kind: "final", text: "one" },
			{ kind: "user", text: "again" },
			{ kind: "tool_call", name: "b" },
			{ kind: "final", text: "two" },
		];
		const actual: Step[] = [
			{ kind: "tool_call", name: "a" },
			{ kind: "final", text: "one" },
		];

		const mismatches = compareSteps(expected, actual, { orderMatters: false });

		expect(mismatches.map((m) => m.index).sort()).toEqual([3, 4]);
	});

	it("never reports a user reply as a mismatch", () => {
		// A reply is an input, replayed verbatim. There is nothing to compare.
		const expected: Step[] = [
			{ kind: "final", text: "one" },
			{ kind: "user", text: "again" },
			{ kind: "final", text: "two" },
		];
		const actual: Step[] = [
			{ kind: "final", text: "one" },
			{ kind: "user", text: "SOMETHING ELSE" },
			{ kind: "final", text: "two" },
		];
		expect(compareSteps(expected, actual, { orderMatters: false })).toEqual([]);
	});

	it("restarts the ordered cursor in every turn", () => {
		// `compareStepsOrdered` walks `actual` with a cursor that only moves forward.
		// Comparison is per turn now, so each turn is walked against ITS OWN actual list
		// and the cursor has to start at 0 again; a cursor carried across turns would sit
		// past the end of turn 2's three-step list before turn 2 is even looked at, and
		// report every one of its steps missing on a run that reproduced the recording
		// exactly. Two turns with the SAME steps is what makes that visible -- with
		// different tools per turn a stale cursor could still be blamed on the tools.
		const session: Step[] = [
			{ kind: "tool_call", name: "get_weather", args: { city: "Paris" } },
			{ kind: "tool_call", name: "get_time", args: { tz: "CET" } },
			{ kind: "final", text: "21 in Paris, 14:00" },
			{ kind: "user", text: "and in London?" },
			{ kind: "tool_call", name: "get_weather", args: { city: "Paris" } },
			{ kind: "tool_call", name: "get_time", args: { tz: "CET" } },
			{ kind: "final", text: "21 in Paris, 14:00" },
		];

		expect(compareSteps(session, [...session], { orderMatters: true })).toEqual([]);
	});

	it("still catches an out-of-order turn 2 once the cursor has restarted", () => {
		// The other half: restarting the cursor must not stop the order being checked
		// inside the turn it restarted in.
		const expected: Step[] = [
			{ kind: "tool_call", name: "get_weather", args: { city: "Paris" } },
			{ kind: "final", text: "21 in Paris" },
			{ kind: "user", text: "and in London?" },
			{ kind: "tool_call", name: "get_weather", args: { city: "London" } },
			{ kind: "tool_call", name: "get_time", args: { tz: "GMT" } },
			{ kind: "final", text: "14 in London" },
		];
		const actual: Step[] = [
			{ kind: "tool_call", name: "get_weather", args: { city: "Paris" } },
			{ kind: "final", text: "21 in Paris" },
			{ kind: "user", text: "and in London?" },
			// Turn 2's two calls, swapped.
			{ kind: "tool_call", name: "get_time", args: { tz: "GMT" } },
			{ kind: "tool_call", name: "get_weather", args: { city: "London" } },
			{ kind: "final", text: "14 in London" },
		];

		const mismatches = compareSteps(expected, actual, { orderMatters: true });
		expect(mismatches.map((mismatch) => mismatch.index)).toEqual([4]);
	});

	it("compares a truncated session only up to the cut", () => {
		const expected: Step[] = [
			{ kind: "final", text: "one" },
			{ kind: "user", text: "dead", enabled: false },
			{ kind: "tool_call", name: "never" },
		];
		const actual: Step[] = [{ kind: "final", text: "one" }];
		expect(compareSteps(expected, actual, { orderMatters: false })).toEqual([]);
	});
});
