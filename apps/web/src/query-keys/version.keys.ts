type ScopeParam = string | number | undefined;

export const versionKeys = {
	details: (id: ScopeParam, versionId: ScopeParam) =>
		["version-details", id, versionId] as const,
	versions: (id: ScopeParam) => ["versions", id] as const,
	committed: (id: ScopeParam) => ["prompt-committed", id] as const,
	compareBranches: (id: ScopeParam) => ["compare-branches", id] as const,
	compareVersionA: (id: ScopeParam, commitA: ScopeParam) =>
		["compare-version", id, "A", commitA] as const,
	compareVersionB: (id: ScopeParam, commitB: ScopeParam) =>
		["compare-version", id, "B", commitB] as const,
};

