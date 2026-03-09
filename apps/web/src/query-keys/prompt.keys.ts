type ScopeParam = string | number | undefined;

const normalizeScopeParam = (value: ScopeParam) =>
	typeof value === "undefined" ? value : String(value);

export const promptKeys = {
	listRoot: () => ["prompts-list"] as const,
	list: (orgId: ScopeParam, projectId: ScopeParam) =>
		["prompts-list", normalizeScopeParam(orgId), normalizeScopeParam(projectId)] as const,
	promptNames: () => ["project-prompt-names"] as const,
	byId: (promptId: ScopeParam) => ["prompt", normalizeScopeParam(promptId)] as const,
	update: (promptId: ScopeParam) => ["prompt-update", normalizeScopeParam(promptId)] as const,
};
