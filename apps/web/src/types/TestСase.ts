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
}

export type TestCaseResponse = {
	testcase: TestCase;
};
