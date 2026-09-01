export type TestStatus = "OK" | "NOK" | "NEED_RUN";

export interface Memory {
	id: number;
	key: string;
}

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
	memoryId: number | null;
	status: TestStatus;
	assertionThoughts: string;
	createdAt: string;
	updatedAt: string;
	assertionType: "AI" | "STRICT";
	assertionValue: string;
	files?: TestCaseFile[];
	placeholderValues?: TestCasePinnedPlaceholderValue[];
}

export type TestCaseResponse = {
	testcase: TestCase;
};
