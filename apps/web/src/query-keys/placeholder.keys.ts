type ScopeParam = string | number | undefined;

export const placeholderKeys = {
	promptPlaceholders: (promptId: ScopeParam) => ["prompt-placeholders", promptId] as const,
};
