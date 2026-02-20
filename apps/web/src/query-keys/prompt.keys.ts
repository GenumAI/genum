type ScopeParam = string | number | undefined;

export const promptKeys = {
	list: (orgId: ScopeParam, projectId: ScopeParam) =>
		["prompts-list", orgId, projectId] as const,
	promptNames: () => ["project-prompt-names"] as const,
	byId: (promptId: ScopeParam) => ["prompt", promptId] as const,
};

