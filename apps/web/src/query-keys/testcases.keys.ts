type ScopeParam = string | number | undefined;

export const testcaseKeys = {
	list: (orgId: ScopeParam, projectId: ScopeParam) =>
		["testcases-list", orgId, projectId] as const,
	promptTestcases: (promptId: ScopeParam) => ["prompt-testcases", promptId] as const,
	byId: (testcaseId: ScopeParam) => ["testcase", testcaseId] as const,
	create: (promptId: ScopeParam) => ["testcase-create", promptId] as const,
	updateInput: (testcaseId: ScopeParam) => ["testcase-update-input", testcaseId] as const,
	updateExpected: (testcaseId: ScopeParam) => ["testcase-update-expected", testcaseId] as const,
	addFile: (testcaseId: ScopeParam) => ["testcase-add-file", testcaseId] as const,
	removeFile: (testcaseId: ScopeParam) => ["testcase-remove-file", testcaseId] as const,
};
