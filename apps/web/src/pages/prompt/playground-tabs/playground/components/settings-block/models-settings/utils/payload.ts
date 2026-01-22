import type { PromptSettings } from "@/types/Prompt";
import type { ResponseModelConfig } from "@/types/AIModel";

interface BuildPayloadParams {
	parameters: Record<string, unknown>;
	formValues: Record<string, unknown>;
	tools: unknown[];
	responseFormat: string;
	jsonSchema: string | null;
	selectedModelId: number | null;
	currentResponseFormat: string;
	prompt?: PromptSettings;
	allowPromptJsonSchemaFallback?: boolean;
}

/**
 * Build the payload for updating model settings
 */
export function buildModelSettingsPayload({
	parameters,
	formValues,
	tools,
	responseFormat,
	jsonSchema,
	selectedModelId,
	currentResponseFormat,
	prompt,
	allowPromptJsonSchemaFallback = true,
}: BuildPayloadParams): Record<string, unknown> {
	const payload: Record<string, unknown> = {};

	if (parameters) {
		for (const param of Object.keys(parameters)) {
			if (param === "response_format" || param === "json_schema") continue;
			const camelKey = param.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
			const value = formValues[camelKey];
			if (value !== undefined && value !== null) {
				payload[param] = value;
			}
		}
	}

	if (Array.isArray(tools)) {
		payload.tools = tools;
	}

	if (responseFormat || currentResponseFormat) {
		payload.response_format = responseFormat || currentResponseFormat;
	}

	if ((responseFormat || currentResponseFormat) === "json_schema") {
		if (jsonSchema) {
			payload.json_schema = jsonSchema;
		} else if (allowPromptJsonSchemaFallback && prompt?.languageModelConfig?.json_schema) {
			payload.json_schema =
				typeof prompt.languageModelConfig.json_schema === "string"
					? prompt.languageModelConfig.json_schema
					: JSON.stringify(prompt.languageModelConfig.json_schema);
		}
	}

	if (selectedModelId) {
		payload.languageModelId = Number(selectedModelId);
	}

	// Clean up undefined/null/empty values
	for (const key of Object.keys(payload)) {
		if (
			payload[key] === undefined ||
			payload[key] === null ||
			(typeof payload[key] === "string" && (payload[key] as string).trim() === "")
		) {
			delete payload[key];
		}
	}

	return payload;
}

/**
 * Get form values from prompt settings
 */
export function getFormValuesFromPrompt(prompt?: PromptSettings) {
	if (!prompt || !prompt.languageModel?.name || !prompt.languageModel?.id) {
		return {
			selectedModel: "",
			selectedModelId: null,
			maxTokens: 0,
			temperature: 0,
			topP: 0,
			frequencyPenalty: 0,
			presencePenalty: 0,
			responseFormat: "",
			reasoningEffort: null,
			verbosity: null,
		};
	}

	const config = prompt.languageModelConfig;

	return {
		selectedModel: prompt.languageModel.name,
		selectedModelId: prompt.languageModel.id,
		maxTokens: config?.max_tokens ?? 0,
		temperature: config?.temperature ?? 0,
		topP: config?.top_p ?? 0,
		frequencyPenalty: config?.frequency_penalty ?? 0,
		presencePenalty: config?.presence_penalty ?? 0,
		responseFormat: config?.response_format || "",
		reasoningEffort: config?.reasoning_effort || null,
		verbosity: config?.verbosity ?? null,
	};
}

/**
 * Get response format options from model config
 */
export function getResponseFormatOptions(
	modelConfig: ResponseModelConfig | null,
	promptResponseFormat?: string,
): string[] {
	const configOptions = modelConfig?.parameters.response_format?.allowed || ["text"];

	if (promptResponseFormat === "json_schema" && !configOptions.includes("json_schema")) {
		return [...configOptions, "json_schema"];
	}

	return configOptions;
}
