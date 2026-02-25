type ScopeParam = string | number | undefined;
type NullableScopeParam = string | number | undefined | null;

export const promptKeys = {
	listRoot: () => ["prompts-list"] as const,
	list: (orgId: ScopeParam, projectId: ScopeParam) =>
		["prompts-list", orgId, projectId] as const,
	promptNames: () => ["project-prompt-names"] as const,
	byId: (promptId: ScopeParam) => ["prompt", promptId] as const,
	update: (promptId: ScopeParam) => ["prompt-update", promptId] as const,
	draft: (promptId: ScopeParam) => ["prompt-draft", promptId] as const,
	inputDraft: (promptId: ScopeParam, testcaseId: NullableScopeParam) =>
		["prompt-input-draft", promptId, testcaseId ?? ""] as const,
};
