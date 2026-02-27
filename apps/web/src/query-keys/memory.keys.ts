type ScopeParam = string | number | undefined;

export const memoryKeys = {
	promptMemories: (promptId: ScopeParam) => ["prompt-memories", promptId] as const,
	selection: (promptId: ScopeParam, testcaseId: ScopeParam | null) =>
		["memory-selection", promptId ?? "unknown", testcaseId ?? "prompt"] as const,
};

