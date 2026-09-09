import type { FunctionCall } from "@/ai/models/types";
import type { FileInput } from "@/services/file.service";
import type {
	ContentBlockParam,
	MessageParam,
} from "@anthropic-ai/sdk/resources/messages/messages";
import type { ProviderRequest } from "..";

export function mapToolsAnthropic(tools: FunctionCall[]) {
	return tools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		input_schema: {
			...tool.parameters,
			type: "object" as const, // This is a workaround to fix the type error
		},
	}));
}

const ANTHROPIC_IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function mapFileToAnthropicContent(file: FileInput): ContentBlockParam {
	const base64Data = file.buffer.toString("base64");
	const isImage = file.contentType.startsWith("image/");

	if (isImage && ANTHROPIC_IMAGE_MEDIA_TYPES.has(file.contentType)) {
		return {
			type: "image",
			source: {
				type: "base64",
				media_type: file.contentType as
					| "image/jpeg"
					| "image/png"
					| "image/gif"
					| "image/webp",
				data: base64Data,
			},
		};
	}

	if (file.contentType === "application/pdf") {
		return {
			type: "document",
			source: {
				type: "base64",
				media_type: "application/pdf",
				data: base64Data,
			},
			title: file.fileName,
		};
	}

	return {
		type: "text",
		text: `File ${file.fileName} is not supported by Anthropic.`,
	};
}

export function mapMessagesAnthropic(request: ProviderRequest) {
	const turns: MessageParam[] =
		!request.files || request.files.length === 0
			? [
					{
						role: "user" as const,
						content: request.question,
					},
				]
			: [
					{
						role: "user" as const,
						content: [
							{
								type: "text" as const,
								text: request.question,
							},
							...request.files.map((file) => mapFileToAnthropicContent(file)),
						],
					},
				];

	for (const message of request.messages ?? []) {
		if (message.role === "assistant") {
			// `PromptRunSchema` permits an assistant message with no tool calls, and the
			// client now appends one for every turn's answer, so an empty text with no
			// calls is reachable: it maps to `content: []`, which Anthropic rejects, and a
			// valid request could only fail at the provider. Same guard Gemini already
			// carries (`gemini/utils.ts`).
			const blocks = [
				...(message.content ? [{ type: "text" as const, text: message.content }] : []),
				...(message.toolCalls ?? []).map((call) => ({
					type: "tool_use" as const,
					id: call.id,
					name: call.name,
					input: call.args,
				})),
			];
			turns.push({
				role: "assistant" as const,
				// An empty text block still beats an empty content array.
				content: blocks.length > 0 ? blocks : [{ type: "text" as const, text: "" }],
			});
		} else if (message.role === "user") {
			turns.push({
				role: "user" as const,
				content: message.content,
			});
		} else {
			turns.push({
				role: "user" as const,
				content: [
					{
						type: "tool_result" as const,
						tool_use_id: message.toolCallId,
						content: message.content,
					},
				],
			});
		}
	}

	return turns;
}
