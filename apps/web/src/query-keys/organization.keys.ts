import { orgScope } from "./scope.keys";

type ScopeParam = string | number | undefined;

export const organizationKeys = {
	byId: (orgId: ScopeParam) => ["organization", orgId] as const,
	models: () => ["organization", "models", ...orgScope()] as const,
	projects: () => ["org", "projects", ...orgScope()] as const,
	members: (orgId: ScopeParam) => ["org", "members", orgId] as const,
	roles: (orgId: ScopeParam) => ["org", "roles", orgId] as const,
	invites: (orgId: ScopeParam) => ["org", "invites", orgId] as const,
	apiKeys: () => ["org", "api-keys", ...orgScope()] as const,
	aiKeys: () => ["org", "ai-keys", ...orgScope()] as const,
	quota: () => ["org", "quota", ...orgScope()] as const,
};
