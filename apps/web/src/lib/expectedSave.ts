/**
 * Where one message's expected answer goes when the author saves it.
 *
 * This is a pure decision and not a hook on purpose. It encodes D6, which is the single
 * way this redesign can silently corrupt existing testcases, and a rule that can only be
 * exercised through a rendered component is a rule nothing in this repo can test: web's
 * vitest runs in `environment: "node"` with no jsdom and no testing-library.
 */
export type ExpectedSave =
	| { kind: "expectedOutput"; answer: string }
	| { kind: "expectedSteps"; index: number; text: string }
	| { kind: "draft"; text: string };

export function expectedSaveFor(params: {
	/** A testcase is selected, so there is somewhere durable to write. */
	hasTestcase: boolean;
	/** The testcase's `expectedSteps` is a non-empty array. */
	hasTrajectory: boolean;
	/** The message's flat index in the trajectory. */
	index: number;
	text: string;
}): ExpectedSave {
	const { hasTestcase, hasTrajectory, index, text } = params;

	// D7: no testcase, no write. The thread is a draft until `Add testcase` materializes
	// the whole of it at once.
	if (!hasTestcase) return { kind: "draft", text };

	// D6: a text testcase stays a text testcase. Its expected answer is a COLUMN, not a
	// step. A testcase with no `expectedSteps` is compared through `expectedOutput` and
	// its assertion; one with an array is compared through `compareSteps`. Giving this one
	// a one-element array -- the tempting way to make the thread uniform -- would move it
	// onto a different comparison, and change its verdict, with no author action.
	if (!hasTrajectory) return { kind: "expectedOutput", answer: text };

	return { kind: "expectedSteps", index, text };
}
