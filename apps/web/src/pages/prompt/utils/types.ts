import type { TestcaseStatuses } from "@/types/Prompt";

export interface Prompt {
	id: number;
	name: string;
	value: string;
	assertionType: string;
	updatedAt: string;
	createdAt: string;
	testcaseStatuses: TestcaseStatuses;
	commited?: boolean;
	memories: {
		length: number;
	};
	lastCommit: {
		commitHash: string;
		createdAt: string;
		author: {
			id: number;
			name: string;
			email: string;
			picture?: string | null;
		};
	} | null;
	_count: {
		memories: number;
		testCases: number;
	};
}

export type DeletePromptModalState = {
	open: boolean;
	prompt?: Prompt;
};
