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

describe("TestcasesUpdateSchema — clearing a trajectory", () => {
	it("accepts expectedSteps: null, which means clear the trajectory", () => {
		expect(TestcasesUpdateSchema.safeParse({ expectedSteps: null }).success).toBe(true);
	});

	it("accepts stepsConfig: null", () => {
		expect(TestcasesUpdateSchema.safeParse({ stepsConfig: null }).success).toBe(true);
	});

	it("still rejects an expectedSteps whose every step is unticked", () => {
		const result = TestcasesUpdateSchema.safeParse({
			expectedSteps: [
				{ kind: "tool_call", name: "search", enabled: false },
				{ kind: "final", text: "done", enabled: false },
			],
		});
		expect(result.success).toBe(false);
	});

	it("still accepts a mixed expectedSteps", () => {
		const result = TestcasesUpdateSchema.safeParse({
			expectedSteps: [
				{ kind: "tool_call", name: "search", enabled: false },
				{ kind: "final", text: "done" },
			],
		});
		expect(result.success).toBe(true);
	});

	it("does not accept lastMismatches -- it is derived from a run, never claimed", () => {
		const result = TestcasesUpdateSchema.safeParse({
			lastMismatches: [{ index: 0, reason: "made up" }],
		});
		expect(result.success).toBe(false);
	});

	it("does not accept lastRunAt -- a run writes it, so an edit cannot pose as one", () => {
		const result = TestcasesUpdateSchema.safeParse({
			lastRunAt: new Date().toISOString(),
		});
		expect(result.success).toBe(false);
	});
});

// The same holes on the create path. The update-path gap was found by accident, and both
// schemas derive from the same generated base -- which carries every column, so a field is
// only rejected where it was explicitly omitted. Tested per schema, never assumed shared.
describe("TestcasesCreateSchema -- fields only a run may write", () => {
	it("does not accept lastMismatches", () => {
		const result = TestcasesCreateSchema.safeParse({
			...BASE_CREATE,
			lastMismatches: [{ index: 0, reason: "made up" }],
		});
		expect(result.success).toBe(false);
	});

	it("does not accept lastRunAt", () => {
		const result = TestcasesCreateSchema.safeParse({
			...BASE_CREATE,
			lastRunAt: new Date().toISOString(),
		});
		expect(result.success).toBe(false);
	});

	it("does not accept lastSteps", () => {
		const result = TestcasesCreateSchema.safeParse({
			...BASE_CREATE,
			lastSteps: [toolStep()],
		});
		expect(result.success).toBe(false);
	});

	it("still accepts the same body without them", () => {
		// Guards the three above against passing for an unrelated reason -- a BASE_CREATE
		// that had itself gone invalid would make every rejection look like a boundary.
		expect(TestcasesCreateSchema.safeParse(BASE_CREATE).success).toBe(true);
	});
});
