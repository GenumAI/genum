type ScopeParam = string | number | undefined;

const normalizeScopeParam = (value: ScopeParam) =>
	typeof value === "undefined" ? value : String(value);

export const versionKeys = {
	details: (id: ScopeParam, versionId: ScopeParam) =>
		["version-details", normalizeScopeParam(id), normalizeScopeParam(versionId)] as const,
	branches: (id: ScopeParam) => ["branches", normalizeScopeParam(id)] as const,
	versions: (id: ScopeParam) => ["versions", normalizeScopeParam(id)] as const,
	compareBranches: (id: ScopeParam) => ["compare-branches", normalizeScopeParam(id)] as const,
	compareVersionA: (id: ScopeParam, commitA: ScopeParam) =>
		["compare-version", normalizeScopeParam(id), "A", normalizeScopeParam(commitA)] as const,
	compareVersionB: (id: ScopeParam, commitB: ScopeParam) =>
		["compare-version", normalizeScopeParam(id), "B", normalizeScopeParam(commitB)] as const,
};
