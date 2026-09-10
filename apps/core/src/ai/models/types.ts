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

/**
 * A tool's `parameters`, kept as the JSON Schema the caller sent.
 *
 * This used to be a shaped `z.object`, which in zod means unknown keys are STRIPPED --
 * silently, on the way into the database. Every keyword the shape did not list went with
 * them: `items`, `format`, `minimum`, `maxItems`, `pattern`, `anyOf`. An array parameter
 * lost its `items` and became `{"type":"array"}`, which several providers reject
 * outright, and the author had no way to see why: the schema they typed and the schema
 * we stored were different documents.
 *
 * So the structure is checked and the content is not. Only what every provider requires
 * of a tool's root is asserted -- an object, with properties if it has any -- and
 * everything below is stored verbatim and adapted at SEND time, per provider, where the
 * differences between them actually live.
 *
 * The cap is a storage bound, not a schema opinion: this JSON is copied into every
 * prompt version and every replayed testcase, so an unbounded one is unbounded many
 * times over.
 */
export const MAX_TOOL_PARAMETERS_BYTES = 100_000;

export const FunctionParameterSchema = z
	.object({
		// Case-insensitive because that is what arrives: some callers and some provider
		// SDKs spell it "OBJECT". The value is stored as sent -- normalising it here would
		// rewrite the caller's document, which is the habit this schema exists to break.
		type: z.string().refine((value) => value.toLowerCase() === "object", {
			message: 'A tool\'s parameters must be a JSON Schema of type "object".',
		}),
		// `z.json()`, not a shape: the value is a JSON Schema node and every keyword in it
		// must survive to the provider. It still has to BE json -- this config is written
		// to a Postgres json column and copied into every prompt version.
		properties: z.record(z.string(), z.json()).optional(),
		required: z.array(z.string()).optional(),
		additionalProperties: z.boolean().optional(),
	})
	// Keeps unrecognised keywords instead of stripping them, and requires them to be json
	// for the same reason as above. `$defs`, `anyOf` and `$ref` all land here.
	.catchall(z.json())
	.refine((parameters) => JSON.stringify(parameters).length <= MAX_TOOL_PARAMETERS_BYTES, {
		message: `A tool's parameters must be at most ${MAX_TOOL_PARAMETERS_BYTES} bytes.`,
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

export type RESPONSE_FORMAT = "text" | "json_object" | "json_schema";
export type REASONING_EFFORT = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type VERBOSITY = "low" | "medium" | "high";

export type ModelConfigParameters = {
	temperature?: number;
	response_format?: RESPONSE_FORMAT;
	tools?: FunctionCall[];
	max_tokens?: number;
	json_schema?: string;
	reasoning_effort?: REASONING_EFFORT;
	verbosity?: VERBOSITY;
};
