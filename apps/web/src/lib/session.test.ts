import { describe, expect, it } from "vitest";

import { effectiveSteps, turnsOf } from "./session";
import type { Step } from "@/types/steps";

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
		const steps = [final("one"), user("two", false), final("two"), user("three", false)];
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
