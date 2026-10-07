import OpenAI from "openai";
import type { ResponseOutputItem } from "openai/resources/responses/responses";
import type { ProviderRequest, ProviderResponse, ToolCall } from "..";
import { answerMapper, inputMapper, responsesConfigMapper } from "./utils";

export async function generateOpenAI(request: ProviderRequest): Promise<ProviderResponse> {
	const start = Date.now();

	const openai = new OpenAI({
		apiKey: request.apikey,
		baseURL: request.baseUrl, // Support custom OpenAI-compatible providers
		timeout: 600_000,
		maxRetries: 5,
	});

	const response = await openai.responses.create({
		model: request.model,
		input: inputMapper(request),
		instructions: request.instruction,
		store: false,
		tools: request.parameters.tools
			? request.parameters.tools.map((tool) => ({
					type: "function",
					...tool,
					strict: tool.strict ?? false,
				}))
			: undefined,
		...responsesConfigMapper(request),
	});

	const items = response.output.filter(
		(message: ResponseOutputItem) =>
			message.type === "message" || message.type === "function_call",
	);
	const message = items[0];
	if (!message) {
		throw new Error("No message from OpenAI");
	}

	const toolCalls: ToolCall[] = items
		.filter((item) => item.type === "function_call")
		.map((item) => ({
			id: item.call_id,
			name: item.name,
			args: JSON.parse(item.arguments) as Record<string, unknown>,
		}));

	const usage = response.usage;
	// The installed SDK's types predate cache_write_tokens. GPT-5.6 and later report it, inside
	// input_tokens like cached_tokens; older models and compatible providers omit it.
	const inputDetails = usage?.input_tokens_details as
		| { cached_tokens?: number; cache_write_tokens?: number }
		| undefined;
	const prompt = usage?.input_tokens ?? 0;
	const completion = usage?.output_tokens ?? 0;

	const result: ProviderResponse = {
		answer: answerMapper(message),
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		tokens: {
			prompt,
			completion,
			total: usage?.total_tokens ?? prompt + completion,
			cacheRead: inputDetails?.cached_tokens ?? 0,
			cacheWrite: inputDetails?.cache_write_tokens ?? 0,
			reasoning: usage?.output_tokens_details?.reasoning_tokens ?? 0,
		},
		response_time_ms: Date.now() - start,
	};

	return result;
}
