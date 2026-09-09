import { describe, expect, it } from "vitest";
import { effectiveSteps, lastEnabledFinal, turnsOf } from "./session";
import { hasEnabledStep } from "./schema";
import type { Step } from "./types";

const call = (name: string, enabled?: boolean): Step => ({
	kind: "tool_call",
	name,
	recordedResult: "{}",
	...(enabled === undefined ? {} : { enabled }),
});
const final = (text: string): Step => ({ kind: "final", text });
const user = (text: string, enabled?: boolean): Step => ({
	kind: "user",
	text,
	...(enabled === undefined ? {} : { enabled }),
});

describe("effectiveSteps", () => {
	it("returns the same array reference when nothing is truncated", () => {
		const steps = [call("a"), final("done")];
		expect(effectiveSteps(steps)).toBe(steps);
	});

	it("cuts the session at an unticked user reply, dropping it and everything after", () => {
		const steps = [call("a"), final("one"), user("again", false), call("b"), final("two")];
		expect(effectiveSteps(steps)).toEqual([call("a"), final("one")]);
	});

	it("keeps a ticked user reply and everything after it", () => {
		const steps = [call("a"), final("one"), user("again"), call("b"), final("two")];
		expect(effectiveSteps(steps)).toEqual(steps);
	});

	it("cuts at the FIRST unticked reply when several are unticked", () => {
		const steps = [
			final("one"),
			user("two", false),
			final("two"),
			user("three", false),
		];
		expect(effectiveSteps(steps)).toEqual([final("one")]);
	});

	it("ignores enabled:false on a tool call -- that means 'do not compare', not 'stop'", () => {
		const steps = [call("a", false), final("one"), user("again"), final("two")];
		expect(effectiveSteps(steps)).toEqual(steps);
	});
});

describe("turnsOf", () => {
	it("returns one turn for a single-turn session", () => {
		const steps = [call("a"), final("done")];
		expect(turnsOf(steps)).toEqual([{ start: 0, steps }]);
	});

	it("starts a new turn at each user reply and records its flat start index", () => {
		const steps = [call("a"), final("one"), user("again"), call("b"), final("two")];
		expect(turnsOf(steps)).toEqual([
			{ start: 0, steps: [call("a"), final("one")] },
			{ start: 2, steps: [user("again"), call("b"), final("two")] },
		]);
	});

	it("returns no turns for an empty list", () => {
		expect(turnsOf([])).toEqual([]);
	});
});

describe("hasEnabledStep", () => {
	it("is true for an enabled tool call", () => {
		expect(hasEnabledStep([call("a")])).toBe(true);
	});

	it("is false when every comparable step is unticked", () => {
		expect(hasEnabledStep([call("a", false), { kind: "final", text: "x", enabled: false }])).toBe(
			false,
		);
	});

	it("is false for a session of nothing but user replies", () => {
		// A reply is replayed verbatim and never compared, so it asserts nothing.
		expect(hasEnabledStep([user("one"), user("two")])).toBe(false);
	});

	it("is false when the only comparable steps are past a truncation", () => {
		// The dangerous case: the raw array looks like it asserts something, and the
		// steps that would do the asserting are dead.
		const steps = [user("stop here", false), call("a"), final("two")];
		expect(hasEnabledStep(steps)).toBe(false);
	});
});

// The one derivation of `expectedOutput`, shared by create and update. A copy of this
// rule on either path is how a testcase ends up pinning an answer from a turn it never
// reaches.
describe("lastEnabledFinal", () => {
	it("is the last final of a whole session", () => {
		expect(lastEnabledFinal([final("one"), user("more"), final("two")])).toEqual(
			final("two"),
		);
	});

	it("stops at the truncation, not at the end of the array", () => {
		expect(
			lastEnabledFinal([final("one"), user("more", false), final("two")]),
		).toEqual(final("one"));
	});

	it("skips an unticked final", () => {
		expect(
			lastEnabledFinal([final("one"), { kind: "final", text: "two", enabled: false }]),
		).toEqual(final("one"));
	});

	it("is undefined when the live part of the session has no enabled final", () => {
		// The caller must leave `expectedOutput` alone here: it is a non-nullable column,
		// and blanking it would make the text testcase underneath assert an empty answer.
		expect(lastEnabledFinal([call("a"), user("more", false), final("dead")])).toBeUndefined();
	});
});
