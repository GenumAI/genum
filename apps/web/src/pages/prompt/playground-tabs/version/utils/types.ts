export interface Author {
	id: number;
	name: string;
	email: string;
	picture?: string;
}

export interface PromptVersion {
	id: number;
	commitMsg: string;
	commitHash: string;
	createdAt: string;
	author: Author;
	branchName?: string;
}

export interface Branch {
	id: number;
	promptId: number;
	name: string;
	createdAt: string;
	promptVersions: PromptVersion[];
}

export interface BranchesResponse {
	branches: Branch[];
}

export interface AuditRisk {
	type: string;
	level: "low" | "medium" | "high";
	comment: string;
	recommendation: string;
}

export interface AuditData {
	rate: number;
	risks: AuditRisk[];
	summary: string;
}
