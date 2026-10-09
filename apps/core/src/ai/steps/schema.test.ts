import { describe, expect, it } from "vitest";
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
