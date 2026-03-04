type ScopeParam = string | number | undefined | null;

export const modelsSettingsKeys = {
	root: () => ["models-settings"] as const,
	modelConfig: (modelId: ScopeParam) => ["models-settings", "model-config", modelId] as const,
	updatePromptModel: (promptId: ScopeParam) =>
		["models-settings", "update-prompt-model", promptId] as const,
	updatePromptConfig: (promptId: ScopeParam) =>
		["models-settings", "update-prompt-config", promptId] as const,
};
