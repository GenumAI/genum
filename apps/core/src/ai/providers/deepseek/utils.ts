import type {
	ChatCompletionFunctionTool,
	ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type { ProviderRequest } from "..";
import type { FunctionCall } from "@/ai/models/types";

/**
 * DeepSeek's V4 Flash and Pro models are text-only — only the (experimental) vision
 * checkpoint accepts images. Attached files would be silently dropped, so refuse instead.
 */
export function mapMessagesDeepSeek(request: ProviderRequest): ChatCompletionMessageParam[] {
	if (request.files && request.files.length > 0) {
		throw new Error("DeepSeek models do not support file attachments");
	}

	const messages: ChatCompletionMessageParam[] = [
		{ role: "system", content: request.instruction },
		{ role: "user", content: request.question },
	];

	for (const message of request.messages ?? []) {
		if (message.role === "assistant") {
			messages.push({
				role: "assistant",
				content: message.content,
				tool_calls: message.toolCalls?.map((call) => ({
					id: call.id,
					type: "function" as const,
					function: { name: call.name, arguments: JSON.stringify(call.args) },
				})),
			});
		} else if (message.role === "user") {
			messages.push({
				role: "user",
				content: message.content,
			});
		} else {
			messages.push({
				role: "tool",
				tool_call_id: message.toolCallId,
				content: message.content,
			});
		}
	}

	return messages;
}

/** Our flat FunctionCall shape into the nested shape chat completions expects. */
export function mapToolsDeepSeek(tools: FunctionCall[]): ChatCompletionFunctionTool[] {
	return tools.map((tool) => ({
		type: "function",
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters as Record<string, unknown>,
			strict: tool.strict ?? false,
		},
	}));
}

/**
 * DeepSeek supports `text` and `json_object` only — `json_schema` is not part of its API,
 * and the model registry does not offer it for DeepSeek models.
 */
export function responseFormatDeepSeek(request: ProviderRequest) {
	return request.parameters.response_format === "json_object"
		? ({ type: "json_object" } as const)
		: ({ type: "text" } as const);
}
