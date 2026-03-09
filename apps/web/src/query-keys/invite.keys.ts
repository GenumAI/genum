type ScopeParam = string | undefined;

export const inviteKeys = {
	all: () => ["invite"] as const,
	validation: (token: ScopeParam) => ["invite", "validation", token] as const,
};
