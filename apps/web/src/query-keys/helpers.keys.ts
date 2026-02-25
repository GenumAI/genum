export const helperKeys = {
	promptTune: () => ["prompt-tune"] as const,
	contentPrettify: (normalizedContent: string) =>
		["content-prettify", normalizedContent] as const,
};

