import { type GenerateContentConfig, Type } from "@google/genai";
import type { FunctionCall } from "../../models/types";
import type { ProviderRequest } from "..";

interface GeminiSchema {
	type: string;
	properties?: Record<string, unknown>;
	required?: string[];
	additionalProperties?: boolean;
}

function mapSchemaToGeminiFormat(schemaStr: string): GeminiSchema {
	const schema = JSON.parse(schemaStr);

	// If schema is wrapped in a name/strict/schema structure, extract the actual schema
	const actualSchema = schema.schema || schema;

	// Map type names to lowercase
	const mappedSchema: GeminiSchema = {
		type: actualSchema.type.toLowerCase(),
		properties: actualSchema.properties,
		required: actualSchema.required,
		additionalProperties: actualSchema.additionalProperties,
	};

	// Recursively map nested properties
	if (mappedSchema.properties) {
		const properties = mappedSchema.properties;
		Object.entries(properties).forEach(([key, value]) => {
			if (
				typeof value === "object" &&
				value !== null &&
				"type" in value &&
				typeof value.type === "string"
			) {
				// Type assertion: we know value has a mutable type property at this point
				(value as { type: string }).type = value.type.toLowerCase();
			}
			if (typeof value === "object" && value !== null && "properties" in value) {
				properties[key] = mapSchemaToGeminiFormat(JSON.stringify(value));
			}
		});
	}

	return mappedSchema;
}

function mapFunctionToGeminiFormat(func: FunctionCall): {
	name: string;
	description: string;
	parameters: {
		type: Type;
		properties: Record<
			string,
			{
				type: Type;
				description?: string;
			}
		>;
	};
} {
	return {
		name: func.name,
		description: func.description || "",
		parameters: {
			type: Type.OBJECT,
			properties: func.parameters.properties
				? Object.entries(func.parameters.properties).reduce(
						(acc, [key, value]) => {
							acc[key] = {
								type: mapTypeToGeminiType(value.type),
								description: value.description || "",
							};
							return acc;
						},
						{} as Record<
							string,
							{
								type: Type;
								description: string;
							}
						>,
					)
				: {},
		},
	};
}

function mapTypeToGeminiType(type: string): Type {
	switch (type.toLowerCase()) {
		case "string":
			return Type.STRING;
		case "number":
			return Type.NUMBER;
		case "boolean":
			return Type.BOOLEAN;
		case "object":
			return Type.OBJECT;
		case "array":
			return Type.ARRAY;
		default:
			return Type.STRING;
	}
}

export function mapConfigToGemini(request: ProviderRequest): GenerateContentConfig {
	return {
		systemInstruction: request.instruction,
		temperature: request.parameters.temperature,
		maxOutputTokens: request.parameters.max_tokens,
		responseMimeType: request.parameters.json_schema ? "application/json" : undefined,
		responseSchema: request.parameters.json_schema
			? mapSchemaToGeminiFormat(request.parameters.json_schema)
			: undefined,
		tools:
			request.parameters.tools && request.parameters.tools.length > 0
				? [
						{
							functionDeclarations: request.parameters.tools.map(
								(func: FunctionCall) => mapFunctionToGeminiFormat(func),
							),
						},
					]
				: undefined,
	};
}
