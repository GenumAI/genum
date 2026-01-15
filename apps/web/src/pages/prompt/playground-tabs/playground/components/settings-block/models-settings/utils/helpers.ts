import type { Model } from "@/types/AIModel";

/**
 * Check if the model is a reasoning model (o3-mini, o4-mini)
 */
export const isReasoningModel = (modelName: string): boolean => {
	return (
		modelName?.toLowerCase().includes("o3-mini") || modelName?.toLowerCase().includes("o4-mini")
	);
};

/**
 * Format price with $ sign and 2 decimal places
 */
export const formatPrice = (price: number): string => {
	return `${price.toFixed(2)}$`;
};

/**
 * Get description for model parameter
 */
export const getParameterDescription = (paramKey: string): string => {
	const descriptions: Record<string, string> = {
		temperature:
			"Defines how much randomness the model introduces into its responses. Lower values make responses focused and predictable, higher ones more creative but less consistent.",
		max_tokens:
			"Defines the upper limit of tokens (words + subwords) the model can generate in a single response.",
		verbosity:
			"Controls how detailed or concise the response should be, balancing brief summaries against more elaborate explanations.",
		reasoning_effort:
			"Determines how much internal computation the model dedicates to reasoning before producing an answer.",
	};

	return descriptions[paramKey] || "";
};

/**
 * Convert snake_case to camelCase
 */
export const snakeToCamel = (str: string): string => {
	return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

/**
 * Convert camelCase to snake_case
 */
export const camelToSnake = (str: string): string => {
	return str.replace(/([A-Z])/g, "_$1").toLowerCase();
};

/**
 * Format vendor name for display
 */
export const formatVendorName = (vendor: string): string => {
	if (vendor === "OPENAI") return "OpenAI";
	return vendor.charAt(0) + vendor.slice(1).toLowerCase();
};

/**
 * Group models by vendor
 */
export const groupModelsByVendor = (models: Model[]): Record<string, Model[]> => {
	return models.reduce(
		(groups, model) => {
			const vendor = model.vendor?.toUpperCase() || "OTHER";
			if (!groups[vendor]) groups[vendor] = [];
			groups[vendor].push(model);
			return groups;
		},
		{} as Record<string, Model[]>,
	);
};

import type { ModelSettingsFormValues } from "./types";

/**
 * Type guard to check if a string is a valid key of ModelSettingsFormValues
 */
export const isModelSettingKey = (key: string): key is keyof ModelSettingsFormValues => {
	const validKeys: (keyof ModelSettingsFormValues)[] = [
		"selectedModel",
		"selectedModelId",
		"maxTokens",
		"temperature",
		"topP",
		"frequencyPenalty",
		"presencePenalty",
		"responseFormat",
		"verbosity",
		"reasoningEffort",
	];
	return validKeys.includes(key as keyof ModelSettingsFormValues);
};
