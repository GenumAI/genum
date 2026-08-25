import OpenAI from "openai";
import type { ProviderRequest, ProviderResponse } from "..";
import { mapMessagesDeepSeek, mapToolsDeepSeek, responseFormatDeepSeek } from "./utils";

/** DeepSeek exposes an OpenAI-compatible chat completions API at this host. */
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

/**
 * DeepSeek speaks the OpenAI wire format, so it reuses the OpenAI SDK — but only the
 * chat completions endpoint. It has no Responses API, which is what `generateOpenAI` uses,
 * so the two providers cannot share an implementation.
 */
export async function generateDeepSeek(request: ProviderRequest): Promise<ProviderResponse> {
	const start = Date.now();

	const deepseek = new OpenAI({
		apiKey: request.apikey,
		baseURL: request.baseUrl ?? DEEPSEEK_BASE_URL,
		timeout: 600_000,
		maxRetries: 5,
	});

	const response = await deepseek.chat.completions.create({
		model: request.model,
		messages: mapMessagesDeepSeek(request),
		temperature: request.parameters.temperature,
		max_tokens: request.parameters.max_tokens,
		response_format: responseFormatDeepSeek(request),
		tools: request.parameters.tools ? mapToolsDeepSeek(request.parameters.tools) : undefined,
		// DeepSeek accepts "max" in addition to OpenAI's efforts; the SDK's union is narrower.
		reasoning_effort: request.parameters.reasoning_effort as never,
	});

	const message = response.choices[0]?.message;
	if (!message) {
		throw new Error("No message from DeepSeek");
	}

	const toolCall = message.tool_calls?.[0];
	let answer: string;
	if (toolCall && toolCall.type === "function") {
		answer = JSON.stringify({
			id: toolCall.id,
			name: toolCall.function.name,
			arguments: JSON.parse(toolCall.function.arguments),
		});
	} else if (message.content) {
		answer = message.content;
	} else {
		throw new Error("No answer from DeepSeek");
	}

	const result: ProviderResponse = {
		answer,
		tokens: {
			prompt: response.usage?.prompt_tokens ?? 0,
			completion: response.usage?.completion_tokens ?? 0,
			total: response.usage?.total_tokens ?? 0,
		},
		response_time_ms: Date.now() - start,
		// Thinking-mode output, surfaced in the playground as chain of thoughts.
		chainOfThoughts: (message as { reasoning_content?: string }).reasoning_content,
	};

	return result;
}
