type ScopeParam = string | number | undefined;

export const testcaseKeys = {
	list: (orgId: ScopeParam, projectId: ScopeParam) =>
		["testcases-list", orgId, projectId] as const,
	promptTestcases: (promptId: ScopeParam) => ["prompt-testcases", promptId] as const,
	statusCounts: (promptId: ScopeParam) => ["testcase-status-counts", promptId] as const,
	byId: (testcaseId: ScopeParam) => ["testcase", testcaseId] as const,
	byIdAlt: (testcaseId: ScopeParam) => ["testcaseById", testcaseId] as const,
};

