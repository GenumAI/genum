type ScopeParam = string | number | undefined;

export const helperKeys = {
	promptTune: () => ["prompt-tune"] as const,
	generateInput: (promptId: ScopeParam) => ["generate-input", promptId] as const,
	contentPrettify: (normalizedContent: string) =>
		["content-prettify", normalizedContent] as const,
};
