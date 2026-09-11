import type { Step, StepMismatch, StepsConfig } from "@/types/steps";

export type TestStatus = "OK" | "NOK" | "NEED_RUN";

export interface TestCaseFile {
	id: number;
	testcaseId: number;
	fileId: string;
	file: {
		id: string;
		key: string;
		name: string;
		size: number;
		contentType: string;
		projectId: number;
		createdAt: string;
	};
}

// The testcase's pinned placeholder selection (Task 8). The list endpoint
// (getTestcasesByPromptId) includes this alongside the detail read so the
// playground can seed its chips from a testcase's pin without a second fetch.
export interface TestCasePinnedPlaceholderValue {
	placeholderId: number;
	placeholderValueId: number;
	placeholderValue: {
		id: number;
		name: string;
		isDefault: boolean;
		placeholder: {
			id: number;
			key: string;
		};
	};
}

export interface TestCase {
	id: number;
	name: string;
	promptId: number;
	input: string;
	expectedOutput: string;
	expectedChainOfThoughts: string;
	lastOutput: string;
	lastChainOfThoughts: string;
	status: TestStatus;
	assertionThoughts: string;
	createdAt: string;
	updatedAt: string;
	/**
	 * When a run last wrote a result. Null until the testcase has been run. Distinct from
	 * `updatedAt`, which every edit bumps: the verdict is not recomputed when expectations
	 * change, so only this can say how old the verdict beside them is.
	 */
	lastRunAt?: string | null;
	assertionType: "AI" | "STRICT";
	assertionValue: string;
	/**
	 * Present only on a trajectory testcase. `expectedSteps` is what is asserted,
	 * `lastSteps` what the last run actually did, `lastMismatches` which expected steps it
	 * failed to match. All are `Json?` columns, always sent as `null` or an array; the
	 * compiler enforces a null check before use. The remaining untrusted part is the shape
	 * inside a non-null value, which may have been written by an old schema version.
	 */
	expectedSteps?: Step[] | null;
	lastSteps?: Step[] | null;
	stepsConfig?: StepsConfig | null;
	lastMismatches?: StepMismatch[] | null;
	/**
	 * The tools the recorded session offered its model, by name. `null`/absent means the
	 * recording never said, and a run then offers the prompt's whole list -- which is what
	 * every testcase pinned before this existed did. An empty array is the other answer:
	 * the model was offered none.
	 */
	offeredTools?: string[] | null;
	/**
	 * A later turn of the recorded session ran with a different placeholder selection or a
	 * different tool subset than the turn this testcase pinned. See `sessionSelections`.
	 */
	pinnedSelectionDrift?: boolean;
	files?: TestCaseFile[];
	placeholderValues?: TestCasePinnedPlaceholderValue[];
}

export type TestCaseResponse = {
	testcase: TestCase;
};
