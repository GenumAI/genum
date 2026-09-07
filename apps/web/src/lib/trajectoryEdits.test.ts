import { describe, expect, it } from "vitest";

import type { Step, StepMismatch } from "@/types/steps";
import { enabledCount, mismatchByIndex, withFinalText, withStepPatch } from "./trajectoryEdits";

const steps: Step[] = [
	{ kind: "tool_call", name: "search", args: { q: "cats" }, argsMatch: "exact" },
	{ kind: "tool_call", name: "log", enabled: false },
	{ kind: "final", text: "done" },
];

describe("withStepPatch", () => {
	it("patches one step and leaves the rest identical by reference", () => {
		const next = withStepPatch(steps, 0, { enabled: false });
		expect(next[0]).toEqual({ ...steps[0], enabled: false });
		expect(next[1]).toBe(steps[1]);
		expect(next[2]).toBe(steps[2]);
	});

	it("keeps recordedResult, which is what makes the testcase replayable later", () => {
		const recorded: Step[] = [
			{ kind: "tool_call", name: "search", recordedResult: "12 results" },
		];
		const next = withStepPatch(recorded, 0, { argsMatch: "ignore" });
		expect(next[0]).toMatchObject({ recordedResult: "12 results", argsMatch: "ignore" });
	});
});

describe("enabledCount", () => {
	it("counts a step with enabled absent as enabled", () => {
		// The server's comparison reads `enabled !== false`. Counting `=== true` here
		// would let the UI think a freshly-picked trajectory asserts nothing.
		expect(enabledCount(steps)).toBe(2);
	});

	it("is zero when every step is unticked", () => {
		expect(enabledCount(steps.map((step) => ({ ...step, enabled: false })))).toBe(0);
	});
});

describe("withFinalText", () => {
	it("rewrites the final step's text and nothing else", () => {
		const next = withFinalText(steps, "a new answer");
		expect(next[2]).toEqual({ kind: "final", text: "a new answer" });
		expect(next[0]).toBe(steps[0]);
		expect(next[1]).toBe(steps[1]);
	});

	it("keeps the final step's enabled flag, which the panel owns", () => {
		const pinned: Step[] = [{ kind: "final", text: "old", enabled: false }];
		expect(withFinalText(pinned, "new")).toEqual([
			{ kind: "final", text: "new", enabled: false },
		]);
	});

	it("returns the steps untouched when the trajectory has no final step", () => {
		// A trajectory whose last turn still asked for a tool has none. Appending one
		// would invent an assertion the author never pinned.
		const toolsOnly: Step[] = [{ kind: "tool_call", name: "search" }];
		expect(withFinalText(toolsOnly, "new")).toBe(toolsOnly);
	});
});

describe("mismatchByIndex", () => {
	it("keys reasons by the expected-step index", () => {
		const mismatches: StepMismatch[] = [{ index: 2, reason: "answer differs" }];
		expect(mismatchByIndex(mismatches).get(2)).toBe("answer differs");
	});

	it("is empty for an absent or malformed list", () => {
		expect(mismatchByIndex(undefined).size).toBe(0);
		expect(mismatchByIndex([{ index: "x" }] as unknown as StepMismatch[]).size).toBe(0);
	});
});
