type ScopeParam = string | number | undefined;

export const projectKeys = {
	byScope: (orgId: ScopeParam, projectId: ScopeParam) =>
		["project", orgId, projectId] as const,
	apiKeys: (orgId: ScopeParam, projectId: ScopeParam) =>
		["project", "apiKeys", orgId, projectId] as const,
	usage: (
		orgId: ScopeParam,
		projectId: ScopeParam,
		fromDate: string,
		toDate: string,
	) => ["project-usage", orgId, projectId, fromDate, toDate] as const,
};

