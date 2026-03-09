type ScopeParam = string | number | undefined;

export const memoryKeys = {
	promptMemories: (promptId: ScopeParam) => ["prompt-memories", promptId] as const,
};
