import type { ReasoningEffort } from "openai/resources/shared.js";
import type {
	ResponseFormatTextConfig,
	ResponseFormatTextJSONSchemaConfig,
	ResponseOutputItem,
} from "openai/resources/responses/responses.js";
import type { FileInput } from "@/services/file.service";
import { normalizeJsonSchema, type ProviderRequest } from "..";

export function answerMapper(message: ResponseOutputItem): string {
	if (message.type === "message") {
		if (message.content[0].type === "output_text") {
			return message.content[0].text;
		} else if (message.content[0].type === "refusal") {
			throw new Error(`OpenAI refused to answer: ${message.content[0].refusal}`);
		} else {
			return JSON.stringify(message.content[0]);
		}
	} else if (message.type === "function_call") {
		return JSON.stringify({
			id: message.call_id,
			name: message.name,
			arguments: JSON.parse(message.arguments),
		});
	} else {
		throw new Error(`Invalid message type: ${message.type}`);
	}
}

export function responsesConfigMapper(request: ProviderRequest) {
	return {
		temperature: request.parameters.temperature,
		max_output_tokens: request.parameters.max_tokens,
		reasoning: request.parameters.reasoning_effort
			? {
					// REASONING_EFFORT spans every vendor; "max" is DeepSeek-only and no
					// OpenAI model offers it, so it can never reach this call.
					effort: request.parameters.reasoning_effort as ReasoningEffort,
				}
			: undefined,
		text: {
			verbosity: request.parameters.verbosity,
			format: responsesFormatConfig(
				request.parameters.response_format || "text",
				request.parameters.json_schema,
			),
		},
	};
}

function responsesFormatConfig(
	response_format: "text" | "json_schema" | "json_object",
	json_schema?: string,
): ResponseFormatTextConfig {
	if (response_format === "text") {
		return {
			type: "text",
		};
	} else if (response_format === "json_schema") {
		const normalizedSchema = normalizeJsonSchema(json_schema || "");
		return {
			type: "json_schema",
			...(normalizedSchema as Omit<ResponseFormatTextJSONSchemaConfig, "type">), // include json schema types, omit type
		};
	} else if (response_format === "json_object") {
		return {
			type: "json_object",
		};
	}
	return {
		type: "text",
	};
}

function mapQuestionWithFiles(question: string, files: FileInput[]) {
	const inputFiles = files.map((file) => {
		const isImage = file.contentType.startsWith("image/");
		const base64Data = file.buffer.toString("base64");

		if (isImage) {
			return {
				type: "input_image" as const,
				image_url: `data:${file.contentType};base64,${base64Data}`,
				detail: "auto" as const,
			};
		} else {
			// PDF and other file types
			return {
				type: "input_file" as const,
				file_data: `data:${file.contentType};base64,${base64Data}`,
				filename: file.fileName,
			};
		}
	});

	return [
		{
			role: "user" as const,
			content: [{ type: "input_text" as const, text: question }, ...inputFiles],
		},
	];
}

export function inputMapper(request: ProviderRequest) {
	const opening =
		request.files && request.files.length > 0
			? mapQuestionWithFiles(request.question, request.files)
			: request.question;

	if (!request.messages || request.messages.length === 0) {
		return opening;
	}

	type ExtraItem =
		| { type: "function_call"; call_id: string; name: string; arguments: string }
		| { type: "function_call_output"; call_id: string; output: string };

	const extra: ExtraItem[] = request.messages.flatMap((message): ExtraItem[] =>
		message.role === "assistant"
			? (message.toolCalls ?? []).map((call) => ({
					type: "function_call",
					call_id: call.id,
					name: call.name,
					arguments: JSON.stringify(call.args),
				}))
			: [
					{
						type: "function_call_output",
						call_id: message.toolCallId,
						output: message.content,
					},
				],
	);

	const openingItems =
		typeof opening === "string" ? [{ role: "user" as const, content: opening }] : opening;

	return [...openingItems, ...extra];
}
