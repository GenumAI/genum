import { z } from "zod";

// Base field types
export const FieldTypeSchema = z.enum(["number", "enum", "array"]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

// Parameter constraints
export const ParameterConstraintsSchema = z.object({
	min: z.number().optional(),
	max: z.number().optional(),
	default: z.union([z.number(), z.string()]).optional(),
	allowed: z.array(z.string()).optional(),
});

export type ParameterConstraints = z.infer<typeof ParameterConstraintsSchema>;

// Function call parameter property schema
export const FunctionParameterPropertySchema = z.object({
	type: z.string(),
	description: z.string().optional(),
	required: z.array(z.string()).optional(),
	properties: z.record(z.string(), z.any()).optional(),
	additionalProperties: z.boolean().optional(),
	enum: z.array(z.string()).optional(),
});

// Function call parameter schema
export const FunctionParameterSchema = z.object({
	type: z.string(),
	required: z.array(z.string()).optional(),
	properties: z.record(z.string(), FunctionParameterPropertySchema).optional(),
	additionalProperties: z.boolean().optional(),
});

// Function call schema
export const FunctionCallSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	strict: z.boolean().optional(),
	parameters: FunctionParameterSchema,
});

export type FunctionCall = z.infer<typeof FunctionCallSchema>;

// Model parameters
export const ModelParametersSchema = z.record(
	z.string(),
	z.object({
		min: z.number().optional(),
		max: z.number().optional(),
		default: z.union([z.number(), z.string(), z.array(z.unknown())]).optional(),
		allowed: z.array(z.string()).optional(),
		json_schema: z.string().optional(),
		tools: z.array(FunctionCallSchema).optional(),
	}),
);
export type ModelParameters = z.infer<typeof ModelParametersSchema>;

// Model configuration
export const ModelConfigSchema = z.object({
	name: z.string(),
	vendor: z.string(),
	parameters: ModelParametersSchema,
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// Full configuration
export const ModelsConfigSchema = z.object({
	models: z.array(ModelConfigSchema),
});

export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

// Function to get default parameters for a model
export function getDefaultParameters(modelConfig: ModelConfig): Record<string, unknown> {
	const defaults: Record<string, unknown> = {};

	for (const [paramName, constraints] of Object.entries(modelConfig.parameters)) {
		if (constraints && constraints.default !== undefined) {
			defaults[paramName] = constraints.default;
		}
	}

	return defaults;
}

export type ModelConfigParameters = {
	temperature?: number;
	response_format?: "text" | "json_object" | "json_schema";
	tools?: FunctionCall[];
	max_tokens?: number;
	json_schema?: string;
	reasoning_effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
	verbosity?: "low" | "medium" | "high";
};
