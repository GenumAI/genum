import { describe, it, expect } from "vitest";

import { TestcasesCreateSchema, TestcasesUpdateSchema } from "./testcase.type";

const BASE_CREATE = {
	promptId: 1,
	name: "trajectory testcase",
	input: "hi",
	expectedOutput: "",
	lastOutput: "",
};

function toolStep(overrides: Record<string, unknown> = {}) {
	return { kind: "tool_call" as const, name: "get_weather", args: {}, ...overrides };
}

describe("TestcasesCreateSchema -- expectedSteps enabled-step boundary", () => {
	it("rejects an expectedSteps array where every step is unticked", () => {
		const result = TestcasesCreateSchema.safeParse({
			...BASE_CREATE,
			expectedSteps: [
				toolStep({ enabled: false }),
				toolStep({ enabled: false }),
				toolStep({ enabled: false }),
				toolStep({ enabled: false }),
				toolStep({ enabled: false }),
			],
		});

		expect(result.success).toBe(false);
	});

	it("accepts a mixed array with at least one enabled step", () => {
		const result = TestcasesCreateSchema.safeParse({
			...BASE_CREATE,
			expectedSteps: [toolStep({ enabled: false }), toolStep({ enabled: true })],
		});

		expect(result.success).toBe(true);
	});

	it("accepts an array where enabled is absent -- absent means enabled, not disabled", () => {
		const result = TestcasesCreateSchema.safeParse({
			...BASE_CREATE,
			expectedSteps: [toolStep()],
		});

		expect(result.success).toBe(true);
	});

	it("still rejects an empty expectedSteps array", () => {
		const result = TestcasesCreateSchema.safeParse({
			...BASE_CREATE,
			expectedSteps: [],
		});

		expect(result.success).toBe(false);
	});
});

describe("TestcasesUpdateSchema -- expectedSteps enabled-step boundary", () => {
	it("rejects an expectedSteps array where every step is unticked", () => {
		const result = TestcasesUpdateSchema.safeParse({
			expectedSteps: [toolStep({ enabled: false }), toolStep({ enabled: false })],
		});

		expect(result.success).toBe(false);
	});

	it("accepts a mixed array with at least one enabled step", () => {
		const result = TestcasesUpdateSchema.safeParse({
			expectedSteps: [toolStep({ enabled: false }), toolStep({ enabled: true })],
		});

		expect(result.success).toBe(true);
	});

	it("accepts an array where enabled is absent", () => {
		const result = TestcasesUpdateSchema.safeParse({
			expectedSteps: [toolStep()],
		});

		expect(result.success).toBe(true);
	});

	it("does not apply the enabled-step rule to lastSteps -- a run's own record, not an assertion", () => {
		const result = TestcasesUpdateSchema.safeParse({
			lastSteps: [toolStep({ enabled: false }), toolStep({ enabled: false })],
		});

		expect(result.success).toBe(true);
	});
});
