import { describe, expect, it } from "vitest";

import type { Step, StepMismatch } from "@/types/steps";
import {
	enabledCount,
	hasStepComparison,
	mismatchByIndex,
	withFinalText,
	withStepPatch,
} from "./trajectoryEdits";

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

describe("hasStepComparison", () => {
	it("is false when the column is null -- the server ran but never compared", () => {
		// `replay.stopped`, an AI assertion and a MANUAL one all leave `lastMismatches`
		// null beside a real verdict. Treating that as "compared, nothing mismatched"
		// paints every pinned step green next to a red NOK.
		expect(hasStepComparison(null)).toBe(false);
	});

	it("is false when the field is absent", () => {
		expect(hasStepComparison(undefined)).toBe(false);
	});

	it("is false for a non-array value from the Json? column", () => {
		expect(hasStepComparison({ index: 0 } as unknown as StepMismatch[])).toBe(false);
	});

	it("is true for an empty array -- compared, and everything passed", () => {
		expect(hasStepComparison([])).toBe(true);
	});

	it("is true for a usable list of mismatches", () => {
		expect(hasStepComparison([{ index: 1, reason: "wrong tool" }])).toBe(true);
	});

	it("is false for a non-empty list whose every entry is unusable", () => {
		// `mismatchByIndex` drops malformed entries, so such a list would otherwise
		// present as "compared, nothing mismatched" -- the JSDoc there promises a wholly
		// malformed list degrades to no per-step marks, and this is what keeps that true.
		const garbage = [{ index: "x" }, { reason: 7 }] as unknown as StepMismatch[];
		expect(mismatchByIndex(garbage).size).toBe(0);
		expect(hasStepComparison(garbage)).toBe(false);
	});

	it("is false when only SOME entries are unusable", () => {
		// The dangerous half of the same bug. A dropped entry names the step that
		// failed, so rendering the rest would paint that step green off an entry we
		// could not read.
		const mixed = [
			{ index: 1, reason: "wrong tool" },
			{ index: "x" },
		] as unknown as StepMismatch[];
		expect(mismatchByIndex(mixed).size).toBe(1);
		expect(hasStepComparison(mixed)).toBe(false);
	});

	it("is true for a readable list that names one index twice", () => {
		// Counting readable entries, not the map's size: a duplicate index collapses in
		// the map, and comparing size to length would misread this as unreadable.
		const duplicated = [
			{ index: 2, reason: "first" },
			{ index: 2, reason: "second" },
		];
		expect(mismatchByIndex(duplicated).size).toBe(1);
		expect(hasStepComparison(duplicated)).toBe(true);
	});
});
