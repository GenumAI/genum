import { describe, it, expect, vi } from "vitest";

// `assertTrajectory` is pure, but it lives in the controller, whose module graph reaches
// the env schema and the Prisma singleton. Same stubs the sibling controller test uses.
vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));
vi.mock("@/database/db", () => ({ db: {} }));

import { assertTrajectory } from "./testcase.controller";
import type { Step } from "@/ai/steps/types";

const expected: Step[] = [
	{ kind: "tool_call", name: "get_weather", args: { city: "Berlin" }, argsMatch: "exact" },
	{ kind: "final", text: "It is 12°" },
];

describe("assertTrajectory", () => {
	it("is OK when the trajectory matches", () => {
		const actual: Step[] = [
			{ kind: "tool_call", name: "get_weather", args: { city: "Berlin" } },
			{ kind: "final", text: "It is 12°" },
		];
		const result = assertTrajectory(expected, actual, null);
		expect(result.status).toBe("OK");
		expect(result.thoughts).toBe("");
	});

	it("is NOK and names the tool when an argument changed", () => {
		const actual: Step[] = [
			{ kind: "tool_call", name: "get_weather", args: { city: "Munich" } },
			{ kind: "final", text: "It is 12°" },
		];
		const result = assertTrajectory(expected, actual, null);
		expect(result.status).toBe("NOK");
		expect(result.thoughts).toContain("get_weather");
	});

	it("honours orderMatters from stepsConfig", () => {
		const reordered: Step[] = [
			{ kind: "final", text: "It is 12°" },
			{ kind: "tool_call", name: "get_weather", args: { city: "Berlin" } },
		];
		expect(assertTrajectory(expected, reordered, null).status).toBe("OK");
		expect(assertTrajectory(expected, reordered, { orderMatters: true }).status).toBe("NOK");
	});

	it("reports every mismatch, not just the first", () => {
		const actual: Step[] = [
			{ kind: "tool_call", name: "get_weather", args: { city: "Munich" } },
			{ kind: "final", text: "It is 30°" },
		];
		const result = assertTrajectory(expected, actual, null);
		expect(result.status).toBe("NOK");
		expect(result.thoughts).toContain("get_weather");
		expect(result.thoughts).toContain("the final answer");
	});

	it("ignores a step the author unticked", () => {
		const withDisabled: Step[] = [
			{ kind: "tool_call", name: "get_weather", args: { city: "Berlin" } },
			{ kind: "final", text: "It is 12°", enabled: false },
		];
		const actual: Step[] = [
			{ kind: "tool_call", name: "get_weather", args: { city: "Berlin" } },
			{ kind: "final", text: "something else entirely" },
		];
		expect(assertTrajectory(withDisabled, actual, null).status).toBe("OK");
	});
});
