import { describe, expect, it } from "vitest";

import type { TestCase } from "./TestСase";
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

describe("testcase trajectory field nullability", () => {
	it("enforces that expectedSteps can be null", () => {
		const testcase: TestCase = {
			id: 1,
			name: "test",
			promptId: 1,
			input: "input",
			expectedOutput: "output",
			expectedChainOfThoughts: "thoughts",
			lastOutput: "last",
			lastChainOfThoughts: "last thoughts",
			status: "OK",
			assertionThoughts: "assertion",
			createdAt: "2024-01-01",
			updatedAt: "2024-01-01",
			assertionType: "STRICT",
			assertionValue: "value",
			expectedSteps: null,
		};
		expect(testcase.expectedSteps).toBeNull();
	});

	it("enforces that lastSteps can be null", () => {
		const testcase: TestCase = {
			id: 1,
			name: "test",
			promptId: 1,
			input: "input",
			expectedOutput: "output",
			expectedChainOfThoughts: "thoughts",
			lastOutput: "last",
			lastChainOfThoughts: "last thoughts",
			status: "OK",
			assertionThoughts: "assertion",
			createdAt: "2024-01-01",
			updatedAt: "2024-01-01",
			assertionType: "STRICT",
			assertionValue: "value",
			lastSteps: null,
		};
		expect(testcase.lastSteps).toBeNull();
	});

	it("enforces that stepsConfig can be null", () => {
		const testcase: TestCase = {
			id: 1,
			name: "test",
			promptId: 1,
			input: "input",
			expectedOutput: "output",
			expectedChainOfThoughts: "thoughts",
			lastOutput: "last",
			lastChainOfThoughts: "last thoughts",
			status: "OK",
			assertionThoughts: "assertion",
			createdAt: "2024-01-01",
			updatedAt: "2024-01-01",
			assertionType: "STRICT",
			assertionValue: "value",
			stepsConfig: null,
		};
		expect(testcase.stepsConfig).toBeNull();
	});

	it("enforces that lastMismatches can be null", () => {
		const testcase: TestCase = {
			id: 1,
			name: "test",
			promptId: 1,
			input: "input",
			expectedOutput: "output",
			expectedChainOfThoughts: "thoughts",
			lastOutput: "last",
			lastChainOfThoughts: "last thoughts",
			status: "OK",
			assertionThoughts: "assertion",
			createdAt: "2024-01-01",
			updatedAt: "2024-01-01",
			assertionType: "STRICT",
			assertionValue: "value",
			lastMismatches: null,
		};
		expect(testcase.lastMismatches).toBeNull();
	});
});
