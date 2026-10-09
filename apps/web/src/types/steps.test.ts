import { describe, expect, it } from "vitest";

import type { TestCase } from "./TestСase";

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
