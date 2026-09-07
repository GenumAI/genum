import type { FileInput } from "@/services/file.service";
import type { ModelConfigParameters } from "../models/types";

export * from "./openai/generate";
export * from "./gemini/generate";
export * from "./deepseek/generate";

export type ProviderRequest = {
	apikey: string;
	instruction: string;
	question: string;
	model: string;
	parameters: ModelConfigParameters;
	files?: FileInput[];
	promptPrice: number;
	completionPrice: number;
	baseUrl?: string; // For custom OpenAI-compatible providers
	messages?: ConversationMessage[];
};

/**
 * One tool call, in the same shape for every vendor. Each provider returns tool calls
 * differently -- OpenAI as `function_call` items, Anthropic as `tool_use` blocks,
 * DeepSeek as `tool_calls`, Gemini as `functionCall` parts -- and each used to flatten
 * them into `answer` as vendor-specific JSON, which is why an assertion on an argument
 * was impossible.
 */
export type ToolCall = {
	id: string;
	name: string;
	args: Record<string, unknown>;
};

/**
 * Turns after the opening question. Absent for a single-shot run, which is every
 * caller that existed before agentic replay.
 */
export type ConversationMessage =
	| { role: "assistant"; content: string; toolCalls?: ToolCall[] }
	| { role: "tool"; toolCallId: string; name: string; content: string };

export type ProviderResponse = {
	answer: string;
	/** Present when the model asked for tools. `answer` keeps its legacy value regardless. */
	toolCalls?: ToolCall[];
	tokens: {
		prompt: number;
		completion: number;
		total: number;
	};
	response_time_ms: number;
	chainOfThoughts?: string;
	status?: string;
};

export function calculateCost(
	tokens: { prompt: number; completion: number },
	prices: { prompt: number; completion: number },
) {
	const tokensPerUnit = 1_000_000; // 1M tokens
	const promptCost = (tokens.prompt / tokensPerUnit) * prices.prompt;
	const completionCost = (tokens.completion / tokensPerUnit) * prices.completion;

	return {
		prompt: promptCost,
		completion: completionCost,
		total: promptCost + completionCost,
	};
}

// Function to handle JSON schema that might be stored as a string
function parseJsonSchema(schema: string | unknown): unknown {
	if (typeof schema === "string") {
		try {
			// Parse the string representation of JSON while preserving order
			return JSON.parse(schema);
		} catch (error) {
			console.error("Error parsing JSON schema string:", error);
			return schema; // Return original if parsing fails
		}
	}

	// If it's already an object, return as is
	return schema;
}

// Function to preserve order in JSON schema
function preserveJsonOrder(jsonObj: unknown): unknown {
	// If it's null or not an object, return as is
	if (jsonObj === null || typeof jsonObj !== "object") {
		return jsonObj;
	}

	// If it's an array, process each element
	if (Array.isArray(jsonObj)) {
		return jsonObj.map((item) => preserveJsonOrder(item));
	}

	// For objects, use Map to maintain insertion order
	const orderedMap = new Map<string, unknown>();

	// First add all keys in their original order
	// Type assertion: we know jsonObj is an object (not array, not null) at this point
	const recordObj = jsonObj as Record<string, unknown>;
	Object.keys(recordObj).forEach((key) => {
		orderedMap.set(key, preserveJsonOrder(recordObj[key]));
	});

	// Convert Map back to object while preserving order
	return Object.fromEntries(orderedMap);
}

export function normalizeJsonSchema(schema: string): Record<string, unknown> {
	const parsedSchema = parseJsonSchema(schema);

	// Preserve the property order
	// Type assertion: JSON schema should be an object, not a primitive or array
	return preserveJsonOrder(parsedSchema) as Record<string, unknown>;
}
