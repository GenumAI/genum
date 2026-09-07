import { describe, expect, it } from "vitest";

import type { ArgsMatch, Step, StepMismatch, StepsConfig } from "./steps";

// These shapes are restated from apps/core, not imported, so nothing but a test stops
// them drifting. Each assertion is a compile-time claim wearing a runtime disguise: if a
// field is renamed or its type narrowed in core and copied here wrongly, this stops
// building.
describe("step type mirrors", () => {
	it("describes a tool call the way core does", () => {
		const step: Step = {
			kind: "tool_call",
			name: "search",
			args: { q: "cats" },
			argsMatch: "exact" satisfies ArgsMatch,
			enabled: false,
			recordedResult: "12 results",
		};
		expect(step.kind).toBe("tool_call");
	});

	it("describes a final step with no args fields", () => {
		const step: Step = { kind: "final", text: "done", enabled: true };
		expect(step.kind).toBe("final");
	});

	it("allows a tool call with neither enabled nor argsMatch, since both are optional", () => {
		const step: Step = { kind: "tool_call", name: "search" };
		expect(step.enabled).toBeUndefined();
	});

	it("describes a mismatch as an index into expectedSteps plus a reason", () => {
		const mismatch: StepMismatch = { index: 2, reason: "called with different arguments" };
		expect(mismatch.index).toBe(2);
	});

	it("describes the steps config", () => {
		const config: StepsConfig = { orderMatters: false };
		expect(config.orderMatters).toBe(false);
	});
});
