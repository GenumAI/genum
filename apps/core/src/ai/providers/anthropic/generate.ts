import Anthropic from "@anthropic-ai/sdk";
import type { ProviderRequest, ProviderResponse, ToolCall } from "..";
import { mapMessagesAnthropic, mapToolsAnthropic } from "./utils";

export async function generateAnthropic(request: ProviderRequest): Promise<ProviderResponse> {
	const start = Date.now();

	const anthropic = new Anthropic({
		apiKey: request.apikey,
	});

	const response = await anthropic.messages.create({
		model: request.model,
		temperature: request.parameters.temperature,
		max_tokens: request.parameters.max_tokens as number,
		system: request.instruction,
		messages: mapMessagesAnthropic(request),
		tools: request.parameters.tools ? mapToolsAnthropic(request.parameters.tools) : undefined,
	});

	let result = "";
	const message = response.content[0];
	if (message.type === "text") {
		result = message.text;
	} else if (message.type === "tool_use") {
		result = JSON.stringify(message);
	} else {
		throw new Error("No answer from Anthropic");
	}

	const toolCalls: ToolCall[] = response.content
		.filter((block) => block.type === "tool_use")
		.map((block) => ({
			id: block.id,
			name: block.name,
			args: (block.input ?? {}) as Record<string, unknown>,
		}));

	const r: ProviderResponse = {
		answer: result,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		tokens: {
			prompt: response.usage.input_tokens,
			completion: response.usage.output_tokens,
			total: response.usage.input_tokens + response.usage.output_tokens,
		},
		response_time_ms: Date.now() - start,
	};

	return r;
}
