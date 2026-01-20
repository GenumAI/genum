import OpenAI from "openai";

export type CustomProviderModel = {
	id: string;
	name: string;
	created?: number;
	ownedBy?: string;
};

export type ListModelsResult = {
	models: CustomProviderModel[];
	error?: string;
};

/**
 * List available models from an OpenAI-compatible provider
 * Works with: OpenAI, Ollama, Together AI, Groq, vLLM, LiteLLM, LM Studio, etc.
 *
 * Note: Some providers (LM Studio, Ollama) don't require an API key.
 * Pass empty string or "not-needed" for such providers.
 */
export async function listOpenAICompatibleModels(
	apiKey: string,
	baseUrl?: string,
): Promise<ListModelsResult> {
	try {
		// Use a placeholder API key if none provided (for providers that don't require auth)
		const effectiveApiKey = apiKey?.trim() || "not-needed";

		const openai = new OpenAI({
			apiKey: effectiveApiKey,
			baseURL: baseUrl,
			timeout: 15_000, // 15 seconds timeout for listing models
			maxRetries: 2,
		});

		const response = await openai.models.list();

		// Handle case where response.data might be undefined or not an array
		if (!response.data || !Array.isArray(response.data)) {
			console.warn(`Unexpected response format from ${baseUrl}:`, response);
			return {
				models: [],
				error: "Unexpected response format from provider",
			};
		}

		const models: CustomProviderModel[] = response.data.map((model) => ({
			id: model.id,
			name: model.id, // Use id as name, can be customized later
			created: model.created,
			ownedBy: model.owned_by,
		}));

		// Sort models alphabetically by id
		models.sort((a, b) => a.id.localeCompare(b.id));

		return { models };
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to list models from provider";

		console.error(`Error listing models from ${baseUrl || "OpenAI"}:`, errorMessage);

		return {
			models: [],
			error: errorMessage,
		};
	}
}

/**
 * Test connection to an OpenAI-compatible provider
 * Returns true if connection is successful, false otherwise
 */
export async function testProviderConnection(apiKey: string, baseUrl?: string): Promise<boolean> {
	try {
		const result = await listOpenAICompatibleModels(apiKey, baseUrl);
		return result.models.length > 0 && !result.error;
	} catch {
		return false;
	}
}
