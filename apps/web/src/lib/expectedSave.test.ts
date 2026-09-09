import { describe, expect, it } from "vitest";

import { expectedSaveFor } from "./expectedSave";

describe("expectedSaveFor", () => {
	it("writes expectedOutput DIRECTLY for a testcase that has no trajectory", () => {
		// D6, and the reason this module exists. A text testcase is compared through
		// `expectedOutput` and its assertion; one with an `expectedSteps` array is
		// compared through `compareSteps`. Synthesizing a one-element array here -- the
		// tempting way to make the thread uniform -- silently moves the testcase onto a
		// different comparison and changes its verdict with no author action.
		const save = expectedSaveFor({
			hasTestcase: true,
			hasTrajectory: false,
			index: 0,
			text: "the expected answer",
		});
		expect(save).toEqual({ kind: "expectedOutput", answer: "the expected answer" });
	});

	it("never produces expectedSteps for a testcase that has no trajectory", () => {
		// Stated separately and negatively: this is the assertion that keeps failing
		// against the wrong implementation even if the right one's shape later changes.
		const save = expectedSaveFor({
			hasTestcase: true,
			hasTrajectory: false,
			index: 0,
			text: "x",
		});
		expect(save.kind).not.toBe("expectedSteps");
	});

	it("writes the addressed step for a testcase that has a trajectory", () => {
		const save = expectedSaveFor({
			hasTestcase: true,
			hasTrajectory: true,
			index: 2,
			text: "turn two's answer",
		});
		expect(save).toEqual({ kind: "expectedSteps", index: 2, text: "turn two's answer" });
	});

	it("keeps the edit local when there is no testcase to write to", () => {
		// D7. Nothing is written per keystroke to a testcase that does not exist; `Add
		// testcase` materializes the thread.
		const save = expectedSaveFor({
			hasTestcase: false,
			hasTrajectory: false,
			index: 0,
			text: "draft",
		});
		expect(save).toEqual({ kind: "draft", text: "draft" });
	});

	it("keeps the edit local without a testcase even when steps were recorded", () => {
		const save = expectedSaveFor({
			hasTestcase: false,
			hasTrajectory: true,
			index: 1,
			text: "draft",
		});
		expect(save.kind).toBe("draft");
	});
});
