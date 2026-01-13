import type {
	ResponseFormatTextConfig,
	ResponseFormatTextJSONSchemaConfig,
	ResponseOutputItem,
} from "openai/resources/responses/responses.js";
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
					effort: request.parameters.reasoning_effort,
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
