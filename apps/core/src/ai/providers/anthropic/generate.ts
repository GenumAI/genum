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

	const { usage } = response;
	const cacheRead = usage.cache_read_input_tokens ?? 0;
	const cacheWrite = usage.cache_creation_input_tokens ?? 0;
	// Anthropic reports cache tokens beside input_tokens, not inside it.
	const prompt = usage.input_tokens + cacheRead + cacheWrite;

	const r: ProviderResponse = {
		answer: result,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		tokens: {
			prompt,
			completion: usage.output_tokens,
			total: prompt + usage.output_tokens,
			cacheRead,
			cacheWrite,
			// Anthropic's usage carries no reasoning count; thinking is billed inside output_tokens.
			reasoning: 0,
		},
		response_time_ms: Date.now() - start,
	};

	return r;
}
