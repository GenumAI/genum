import type { FunctionCall } from "@/ai/models/types";
import type { FileInput } from "@/services/file.service";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
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
	if (!request.files || request.files.length === 0) {
		return [
			{
				role: "user" as const,
				content: request.question,
			},
		];
	}

	const content: ContentBlockParam[] = [
		{
			type: "text",
			text: request.question,
		},
		...request.files.map((file) => mapFileToAnthropicContent(file)),
	];

	return [
		{
			role: "user" as const,
			content,
		},
	];
}
