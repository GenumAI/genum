import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import {
	ModelsConfigSchema,
	type ModelsConfig,
	type ModelConfig,
	type ModelConfigParameters,
} from "./types";
import { AiVendor } from "@/prisma";
import z from "zod";

interface ParameterSchema {
	allowed?: string[];
	min?: number;
	max?: number;
	default: string | number | Array<unknown>;
}

const currentDir = dirname(__filename);

export class ModelConfigService {
	private config: ModelsConfig = { models: [] };

	constructor() {
		this.loadConfig();
	}

	private loadConfig() {
		const configDir = resolve(currentDir, "config");
		const allModels: ModelConfig[] = [];

		try {
			// read all files in config directory
			const files = readdirSync(configDir);

			// filter only json files
			const jsonFiles = files.filter((file) => extname(file) === ".json");

			for (const configFile of jsonFiles) {
				try {
					const configPath = resolve(configDir, configFile);
					const configData = JSON.parse(readFileSync(configPath, "utf-8"));

					const parsed = ModelsConfigSchema.safeParse(configData);
					if (!parsed.success) {
						console.warn(
							`Invalid model config schema in ${configFile}:`,
							z.treeifyError(parsed.error),
						);
						continue;
					}

					allModels.push(...parsed.data.models);
				} catch (error) {
					console.warn(`Failed to load config from ${configFile}:`, error);
				}
			}
		} catch (error) {
			console.error("Failed to read config directory:", error);
		}

		this.config = { models: allModels };
	}

	public getModelConfig(name: string, vendor: AiVendor): ModelConfig | undefined {
		// Try exact match first
		const exactMatch = this.config.models.find(
			(model) => model.name === name && model.vendor === vendor,
		);
		if (exactMatch) {
			return exactMatch;
		}

		// For custom providers, return an empty config by default
		if (vendor === AiVendor.CUSTOM_OPENAI_COMPATIBLE) {
			return this.getDefaultCustomProviderConfig(name);
		}

		return undefined;
	}

	/**
	 * Returns default configuration for custom OpenAI-compatible providers.
	 * This config is used for any model from a custom provider.
	 */
	private getDefaultCustomProviderConfig(modelName: string): ModelConfig {
		return {
			name: modelName,
			vendor: AiVendor.CUSTOM_OPENAI_COMPATIBLE,
			parameters: {},
		};
	}

	/**
	 * Gets the complete configuration for a specific LLM model
	 * @param name The name of the model
	 * @param vendor The vendor of the model
	 * @returns The complete model configuration including parameters and constraints
	 * @throws Error if the model is not found (except for custom providers which use defaults)
	 */
	public getLLMConfig(name: string, vendor: AiVendor): ModelConfig {
		const modelConfig = this.getModelConfig(name, vendor);
		if (!modelConfig) {
			throw new Error(`Model ${name} from vendor ${vendor} not found in configuration`);
		}
		return modelConfig;
	}

	/**
	 * Gets the configuration for a custom model, using database config if available.
	 * Falls back to defaults if no config is stored.
	 * @param modelName The name of the model
	 * @param dbParametersConfig The parameters config from the database (if any)
	 * @returns The model configuration
	 */
	public getCustomModelConfig(
		modelName: string,
		dbParametersConfig?: Record<string, unknown> | null,
	): ModelConfig {
		// If database has a config, convert it to ModelConfig format
		if (dbParametersConfig && Object.keys(dbParametersConfig).length > 0) {
			return {
				name: modelName,
				vendor: AiVendor.CUSTOM_OPENAI_COMPATIBLE,
				parameters: dbParametersConfig as ModelConfig["parameters"],
			};
		}

		// Fall back to default config
		return this.getDefaultCustomProviderConfig(modelName);
	}

	/**
	 * Validates and sanitizes a complete model configuration
	 * @param name Model name
	 * @param vendor Model vendor
	 * @param config Configuration to validate
	 * @returns Validated and sanitized configuration
	 */
	public validateAndSanitizeConfig(
		name: string,
		vendor: AiVendor,
		config: ModelConfigParameters,
		dbParametersConfig?: Record<string, unknown> | null,
	): ModelConfigParameters {
		if (
			vendor === AiVendor.CUSTOM_OPENAI_COMPATIBLE &&
			(!dbParametersConfig || Object.keys(dbParametersConfig).length === 0)
		) {
			return config;
		}

		// If custom model config is provided, use it, otherwise use the default config
		const modelConfig =
			vendor === AiVendor.CUSTOM_OPENAI_COMPATIBLE &&
			dbParametersConfig &&
			Object.keys(dbParametersConfig).length > 0
				? this.getCustomModelConfig(name, dbParametersConfig)
				: this.getLLMConfig(name, vendor);
		const sanitizedConfig: Record<string, unknown> = {};

		for (const [paramName, paramSchemaUntyped] of Object.entries(modelConfig.parameters) as [
			keyof ModelConfigParameters,
			ParameterSchema,
		][]) {
			const paramSchema = paramSchemaUntyped as ParameterSchema;
			const value = config[paramName];

			// If value is not provided or explicitly null (unless null is a valid default/allowed value), use default
			if (value === undefined) {
				// Special handling for json_schema: only apply default if response_format is compatible
				if (paramName === "json_schema") {
					const rf =
						sanitizedConfig.response_format ||
						config.response_format ||
						(modelConfig.parameters.response_format as ParameterSchema)?.default;
					if (rf === "json_object" || rf === "json_schema") {
						sanitizedConfig[paramName] = paramSchema.default;
					}
				} else {
					sanitizedConfig[paramName] = paramSchema.default;
				}
				continue;
			}

			// Special handling for 'tools'
			if (paramName === "tools") {
				if (Array.isArray(value)) {
					// Potentially add deeper validation for tool structure here if needed in the future
					sanitizedConfig[paramName] = value;
				} else {
					// If tools is present but not an array, revert to default (e.g., empty array or model's specific default)
					sanitizedConfig[paramName] = paramSchema.default;
				}
				continue;
			}

			if (paramName === "response_format") {
				const rfParamSchema = paramSchema; // Schema for response_format itself
				let incomingRfValue = value; // Value from input config for response_format

				// Validate incomingRfValue against allowed values for response_format
				if (
					rfParamSchema.allowed &&
					!rfParamSchema.allowed.includes(incomingRfValue as string)
				) {
					incomingRfValue = rfParamSchema.default as string;
				}
				// Now, incomingRfValue is the validated response_format we intend to apply (e.g., 'json_object', 'text')

				// const modelDefinesJsonSchemaParam = modelConfig.parameters.json_schema as
				// 	| ParameterSchema
				// 	| undefined;
				const inputProvidesJsonSchemaStr = config.json_schema;

				if (incomingRfValue === "json_object") {
					sanitizedConfig[paramName] = "json_object"; // Set response_format to 'json_object'
					// For "json_object" mode, a specific json_schema is not used/enforced at the runner level.
					// Therefore, remove any json_schema from the config for this mode.
					delete sanitizedConfig.json_schema;
				} else if (incomingRfValue === "json_schema") {
					// For response_format: 'json_schema' (implies schema is required)
					sanitizedConfig[paramName] = "json_schema";

					// Just check if the input provides a string for json_schema
					if (
						typeof inputProvidesJsonSchemaStr === "string" &&
						inputProvidesJsonSchemaStr.trim() !== ""
					) {
						// Use the schema string as-is without validation or parsing
						sanitizedConfig.json_schema = inputProvidesJsonSchemaStr;
					} else {
						// If no schema provided, use empty object
						sanitizedConfig.json_schema = "{}";
					}
				} else {
					// incomingRfValue is 'text' or another non-JSON format
					sanitizedConfig[paramName] = incomingRfValue; // Set response_format to 'text' or other
					delete sanitizedConfig.json_schema; // Ensure no schema for non-JSON formats
				}
				continue; // Finished processing response_format and its associated json_schema
			}

			// Skip json_schema here as it's fully handled within the 'response_format' block logic
			if (paramName === "json_schema") {
				continue;
			}

			// Validate allowed values if specified
			if (paramSchema.allowed) {
				if (!paramSchema.allowed.includes(value as string)) {
					sanitizedConfig[paramName] = paramSchema.default; // Sanitize to default
				} else {
					sanitizedConfig[paramName] = value;
				}
				continue;
			}

			// Validate numeric range if specified
			if (paramSchema.min !== undefined && paramSchema.max !== undefined) {
				if (
					typeof value !== "number" ||
					value < paramSchema.min ||
					value > paramSchema.max
				) {
					sanitizedConfig[paramName] = paramSchema.default; // Sanitize to default
				} else {
					sanitizedConfig[paramName] = value;
				}
				continue;
			}

			// If parameter is not in schema or has no validation rules (should not happen with good config)
			// but if it does, and it's an unknown parameter from old config, we might want to discard it
			// For now, if it's in modelConfig.parameters, it should have a schema.
			// If a key from `config` is not in `modelConfig.parameters`, it's an extraneous param.
			// The current loop iterates `modelConfig.parameters`, so extraneous params are already ignored.
			// If a param *is* in `modelConfig.parameters` but doesn't hit any rule above, take the value as is.
			// This case should ideally be covered by schema (e.g. type check, or it's a free-form string).
			// For safety, if no rule matched and it's not explicitly handled, consider using default.
			// However, the original strictValidateConfig had a throw for "Invalid parameter schema".
			// We'll assume parameters always have one of the validation structures (allowed, min/max, or special like tools)
			// If a parameter from schema isn't handled above (e.g. just a type: 'string' with no other constraints)
			// we should assign the value if it's of the correct type, or default.
			// For simplicity now, we assume all recognized params are handled.
			if (value !== undefined) {
				// if it was defined in input config
				sanitizedConfig[paramName] = value; // Keep it if no specific validation rule failed above
			} else {
				sanitizedConfig[paramName] = paramSchema.default; // Should have been caught by earlier undefined check
			}
		}

		// Ensure all parameters defined in the model's schema are present in the sanitizedConfig
		// If any are missing (e.g. weren't in input `config` and somehow missed by loop init), add their defaults.
		for (const [paramName, paramSchemaUntyped] of Object.entries(modelConfig.parameters)) {
			const paramSchema = paramSchemaUntyped as ParameterSchema;
			if (sanitizedConfig[paramName] === undefined) {
				// This handles new parameters in the destination model that weren't in the source model's config
				if (
					paramName === "json_schema" &&
					sanitizedConfig.response_format !== "json_object" &&
					sanitizedConfig.response_format !== "json_schema"
				) {
					// don't add default json_schema if response_format is not json
				} else {
					sanitizedConfig[paramName] = paramSchema.default;
				}
			}
		}

		// Final check for response_format and json_schema consistency
		if (
			sanitizedConfig.response_format !== "json_object" &&
			sanitizedConfig.response_format !== "json_schema"
		) {
			delete sanitizedConfig.json_schema;
		}

		return sanitizedConfig;
	}

	/**
	 * Gets the default values for a model's parameters
	 * @param name Model name
	 * @param vendor Model vendor
	 * @returns Object containing parameter names and their default values
	 */
	public getDefaultValues(name: string, vendor: AiVendor): ModelConfigParameters {
		return this.getDefaultValuesForConfig(name, vendor);
	}

	private getDefaultValuesForConfig(
		name: string,
		vendor: AiVendor,
		dbParametersConfig?: Record<string, unknown> | null,
	): ModelConfigParameters {
		if (
			vendor === AiVendor.CUSTOM_OPENAI_COMPATIBLE &&
			(!dbParametersConfig || Object.keys(dbParametersConfig).length === 0)
		) {
			return {};
		}

		const modelConfig =
			vendor === AiVendor.CUSTOM_OPENAI_COMPATIBLE &&
			dbParametersConfig &&
			Object.keys(dbParametersConfig).length > 0
				? this.getCustomModelConfig(name, dbParametersConfig)
				: this.getLLMConfig(name, vendor);
		const defaultValues: Record<string, unknown> = {};

		for (const [paramName, paramConfig] of Object.entries(modelConfig.parameters)) {
			if ("default" in paramConfig) {
				defaultValues[paramName] = paramConfig.default;
			}
		}

		return defaultValues as ModelConfigParameters;
	}

	public getDefaultValuesForModel(
		name: string,
		vendor: AiVendor,
		dbParametersConfig?: Record<string, unknown> | null,
	): ModelConfigParameters {
		return this.getDefaultValuesForConfig(name, vendor, dbParametersConfig);
	}

	public getCustomModelParamsTemplate() {
		return {
			temperature: {
				enabled: false,
				min: 0,
				max: 2,
				default: 0.7,
			},
			max_tokens: {
				enabled: false,
				min: 1,
				max: 128000,
				default: 4096,
			},
			response_format: {
				enabled: false,
				allowed: ["text", "json_object", "json_schema"],
				default: "text",
			},
			tools: {
				enabled: false,
			},
		};
	}
}
