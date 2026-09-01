import { TestStatus } from "@/types/TestСase";

export type TestcaseStatuses = {
	[key in TestStatus]?: number;
};

export type TLanguageModel = {
	id: number;
	name: string;
	vendor: string;
	promptPrice: number;
	completionPrice: number;
	contextTokensMax: number;
	completionTokensMax: number;
	description: string;
	createdAt: string;
	updatedAt: string;
};

export interface PromptSettings {
	id: number;
	value: string;
	languageModelId: number;
	name: string;
	url: string;
	languageModelConfig: {
		tools: any[];
		top_p?: number;
		max_tokens?: number;
		temperature?: number;
		response_format: "json_object" | "text" | "json_schema";
		presence_penalty?: number;
		frequency_penalty?: number;
		reasoning_effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
		verbosity?: "low" | "medium" | "high";
		languageModelId?: number;
		lastUpdated?: number;
		json_schema?: string | object;
	};
	languageModel: TLanguageModel;
	assertionType?: "STRICT" | "MANUAL" | "AI" | string;
	assertionValue?: string;
	projectId?: number;
	commited?: boolean;
	createdAt: string;
	updatedAt: string;
	audit?: any;
	testcaseStatuses?: TestcaseStatuses;
	lastCommit?: {
		commitHash: string;
		createdAt: string;
		author: {
			id: number;
			name: string;
			email: string;
			picture?: string | null;
			avatar?: string | null;
		};
	} | null;
	_count: {
		testCases: number;
	};
}
