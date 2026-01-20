export interface Author {
	id: number;
	name: string;
	email: string;
	picture: string;
}

export interface PromptVersion {
	id: number;
	commitMsg: string;
	commitHash: string;
	createdAt: string;
	author: Author;
	branchName?: string;
}

export type CommitSelectProps = {
	value: string;
	onChange: (v: string) => void;
	versions: PromptVersion[];
	placeholder: string;
};

export interface Branch {
	id: number;
	name: string;
	promptVersions: PromptVersion[];
}

export interface BranchesResponse {
	branches: Branch[];
}

export interface CommitData {
	prompt?: string;
	model?: unknown;
	modelConfig?: unknown;
	jsonSchema?: unknown;
	tools?: unknown;
}

export interface VersionData {
	version: {
		id: number;
		branchId: number;
		commitHash: string;
		commitMsg: string;
		value: string;
		languageModelId: number;
		languageModelConfig: {
			tools: any[];
			top_p: number;
			max_tokens: number;
			temperature: number;
			response_format: string;
			presence_penalty: number;
			frequency_penalty: number;
		};
		audit: {
			rate: number;
			risks: {
				type: string;
				level: "low" | "medium" | "high";
				comment: string;
				recommendation: string;
			}[];
			summary: string;
		};
		authorId: number;
		createdAt: string;
		author: {
			id: number;
			name: string;
			email: string;
			picture: string;
		};
		branch: {
			name: string;
		};
		languageModel: {
			id: number;
			name: string;
			vendor: string;
			description: string;
		};
	};
}
