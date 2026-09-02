export interface Author {
	id: number;
	name: string;
	email: string;
	picture?: string;
	avatar?: string;
}

export interface PromptVersion {
	id: number;
	commitMsg: string;
	commitHash: string;
	createdAt: string;
	author: Author;
	branchName?: string;
	/**
	 * The placeholder definitions this commit froze. `null` on commits made before
	 * placeholders existed — distinct from `[]`, which is a commit that had none. Typed
	 * as unknown because it is a Json column: CommitPlaceholders does the narrowing.
	 */
	placeholders?: unknown;
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
