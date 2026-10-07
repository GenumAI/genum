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

/**
 * Claude Opus 4.8 and the 5.x models take an effort level and think adaptively. The 5.x models
 * think by default and Opus 4.8 does not, so asking explicitly makes effort mean the same thing
 * on all of them. An absent effort leaves the model's own default. SDK 0.58 types neither field;
 * the body passes through as sent.
 */
function thinkingParams(request: ProviderRequest) {
	const registered = findRegistryModel(AiVendor.ANTHROPIC, request.model);
	if (registered?.parameters.reasoning_effort === undefined) return {};
	const effort = request.parameters.reasoning_effort;
	return {
		thinking: { type: "adaptive" },
		...(effort ? { output_config: { effort } } : {}),
	};
}

export async function generateAnthropic(request: ProviderRequest): Promise<ProviderResponse> {
	const start = Date.now();

	const anthropic = new Anthropic({
		apiKey: request.apikey,
	});

	// Streamed and then collected whole. Without a stream the SDK refuses, before sending
	// anything, any max_tokens it estimates could run past ten minutes (above ~21K), and every
	// registry model defaults max_tokens to its full output limit.
	const stream = anthropic.messages.stream({
		model: request.model,
		temperature: acceptsTemperature(request.model) ? request.parameters.temperature : undefined,
		max_tokens: request.parameters.max_tokens as number,
		system: request.instruction,
		messages: mapMessagesAnthropic(request),
		tools: request.parameters.tools ? mapToolsAnthropic(request.parameters.tools) : undefined,
		...thinkingParams(request),
	} as Anthropic.MessageStreamParams);

	// The SDK's accumulator keeps only the plain usage counts; the thinking share of
	// output_tokens arrives on message_delta alone.
	let thinkingTokens = 0;
	stream.on("streamEvent", (event) => {
		if (event.type !== "message_delta") return;
		const details = (event.usage as { output_tokens_details?: { thinking_tokens?: number } })
			.output_tokens_details;
		thinkingTokens = details?.thinking_tokens ?? thinkingTokens;
	});

	const response = await stream.finalMessage();

	let result = "";
	// Thinking blocks come before the answer; they carry no answer of their own.
	const message = response.content.find(
		(block) => block.type !== "thinking" && block.type !== "redacted_thinking",
	);
	if (message?.type === "text") {
		result = message.text;
	} else if (message?.type === "tool_use") {
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
			// Thinking is billed inside output_tokens; this is its share, not an addition.
			reasoning: thinkingTokens,
		},
		response_time_ms: Date.now() - start,
	};

	return r;
}
