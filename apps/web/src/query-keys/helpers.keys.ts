type ScopeParam = string | number | undefined;

export const helperKeys = {
	promptTune: () => ["prompt-tune"] as const,
	fixRisks: (promptId: ScopeParam) => ["helper-fix-risks", promptId] as const,
	generateInput: (promptId: ScopeParam) => ["generate-input", promptId] as const,
	contentPrettify: (normalizedContent: string) =>
		["content-prettify", normalizedContent] as const,
	auditData: (promptId: ScopeParam) => ["helper-audit-data", promptId] as const,
};
