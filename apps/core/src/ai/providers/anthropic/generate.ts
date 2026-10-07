import Anthropic from "@anthropic-ai/sdk";
import { AiVendor } from "@/prisma";
import type { ProviderRequest, ProviderResponse, ToolCall } from "..";
import { findRegistryModel } from "../../models/pricing";
import { mapMessagesAnthropic, mapToolsAnthropic } from "./utils";

/**
 * Claude 4.7 and later answer 400 to any non-default temperature, so the registry declares none
 * for them. The stored config is not enough to go by: a prompt saved while the model still
 * declared one keeps it.
 */
function acceptsTemperature(model: string): boolean {
	return findRegistryModel(AiVendor.ANTHROPIC, model)?.parameters.temperature !== undefined;
}

export async function generateAnthropic(request: ProviderRequest): Promise<ProviderResponse> {
	const start = Date.now();

	const anthropic = new Anthropic({
		apiKey: request.apikey,
	});

	// Streamed and then collected whole. Without a stream the SDK refuses, before sending
	// anything, any max_tokens it estimates could run past ten minutes (above ~21K), and every
	// registry model defaults max_tokens to its full output limit.
	const response = await anthropic.messages
		.stream({
			model: request.model,
			temperature: acceptsTemperature(request.model)
				? request.parameters.temperature
				: undefined,
			max_tokens: request.parameters.max_tokens as number,
			system: request.instruction,
			messages: mapMessagesAnthropic(request),
			tools: request.parameters.tools
				? mapToolsAnthropic(request.parameters.tools)
				: undefined,
		})
		.finalMessage();

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
