type ScopeParam = string | number | undefined;

export const promptKeys = {
	listRoot: () => ["prompts-list"] as const,
	list: (orgId: ScopeParam, projectId: ScopeParam) =>
		["prompts-list", orgId, projectId] as const,
	promptNames: () => ["project-prompt-names"] as const,
	byId: (promptId: ScopeParam) => ["prompt", promptId] as const,
	update: (promptId: ScopeParam) => ["prompt-update", promptId] as const,
};
