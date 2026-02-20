type ScopeParam = string | number | undefined;

export const organizationKeys = {
	byId: (orgId: ScopeParam) => ["organization", orgId] as const,
	models: () => ["organization", "models"] as const,
	projects: () => ["org", "projects"] as const,
	members: (orgId: ScopeParam) => ["org", "members", orgId] as const,
	invites: (orgId: ScopeParam) => ["org", "invites", orgId] as const,
	apiKeys: () => ["org", "api-keys"] as const,
	aiKeys: () => ["org", "ai-keys"] as const,
	quota: () => ["org", "quota"] as const,
};

