import OpenAI from "openai";
import type { ResponseOutputItem } from "openai/resources/responses/responses";
import type { ProviderRequest, ProviderResponse } from "..";
import { answerMapper, responsesConfigMapper } from "./utils";

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
		input: request.question,
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

	const message = response.output.filter(
		(message: ResponseOutputItem) =>
			message.type === "message" || message.type === "function_call",
	)[0];
	if (!message) {
		throw new Error("No message from OpenAI");
	}

	const result: ProviderResponse = {
		answer: answerMapper(message),
		tokens: {
			prompt: Number(response.usage?.input_tokens),
			completion: Number(response.usage?.output_tokens),
			total: Number(response.usage?.total_tokens),
		},
		response_time_ms: Date.now() - start,
	};

	return result;
}
