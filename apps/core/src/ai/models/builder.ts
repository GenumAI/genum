import type { AiVendor } from "@/prisma";
import type { ModelConfig, ModelParameters } from "./types";

/** Fields used by seed/DB (LanguageModel table) */
export type SeedModelFields = {
	name: string;
	displayName?: string;
	vendor: AiVendor;
	promptPrice: number;
	completionPrice: number;
	contextTokensMax: number;
	completionTokensMax: number;
	description: string;
};

export type BuiltModel = SeedModelFields & {
	/** API parameters schema for validation (ModelConfig.parameters) */
	parameters: ModelParameters;
};

type ModelBuilderState = {
	name: string;
	vendor: AiVendor;
	displayName?: string;
	description: string;
	promptPrice: number;
	completionPrice: number;
	contextTokensMax: number;
	completionTokensMax: number;
	parameters: ModelParameters;
};

function createModelBuilder(name: string, vendor: AiVendor): ModelBuilder {
	const state: ModelBuilderState = {
		name,
		vendor,
		description: "",
		promptPrice: 0,
		completionPrice: 0,
		contextTokensMax: 0,
		completionTokensMax: 0,
		parameters: {},
	};

	const builder: ModelBuilder = {
		displayName(value: string) {
			state.displayName = value;
			return builder;
		},

		description(value: string) {
			state.description = value;
			return builder;
		},

		pricing(promptPrice: number, completionPrice: number) {
			state.promptPrice = promptPrice;
			state.completionPrice = completionPrice;
			return builder;
		},

		limits(contextTokensMax: number, completionTokensMax: number) {
			state.contextTokensMax = contextTokensMax;
			state.completionTokensMax = completionTokensMax;
			return builder;
		},

		temperature(min: number, max: number, defaultValue: number) {
			state.parameters.temperature = { min, max, default: defaultValue };
			return builder;
		},

		maxTokens(min: number, max: number, defaultValue?: number) {
			const defaultTokens = defaultValue ?? max;
			state.parameters.max_tokens = { min, max, default: defaultTokens };
			return builder;
		},

		responseFormat(allowed: readonly string[], defaultValue) {
			state.parameters.response_format = {
				allowed: [...allowed],
				default: defaultValue,
			};
			return builder;
		},

		tools(defaultValue: unknown[] = []) {
			state.parameters.tools = { default: defaultValue };
			return builder;
		},

		reasoningEffort(allowed: readonly string[], defaultValue: string) {
			state.parameters.reasoning_effort = {
				allowed: [...allowed],
				default: defaultValue,
			};
			return builder;
		},

		verbosity(allowed: readonly string[], defaultValue: string) {
			state.parameters.verbosity = {
				allowed: [...allowed],
				default: defaultValue,
			};
			return builder;
		},

		build(): BuiltModel {
			return {
				name: state.name,
				displayName: state.displayName,
				vendor: state.vendor,
				promptPrice: state.promptPrice,
				completionPrice: state.completionPrice,
				contextTokensMax: state.contextTokensMax,
				completionTokensMax: state.completionTokensMax,
				description: state.description,
				parameters: { ...state.parameters },
			};
		},
	};

	return builder;
}

export interface ModelBuilder {
	displayName(value: string): ModelBuilder;
	description(value: string): ModelBuilder;
	pricing(promptPrice: number, completionPrice: number): ModelBuilder;
	limits(contextTokensMax: number, completionTokensMax: number): ModelBuilder;
	temperature(min: number, max: number, defaultValue: number): ModelBuilder;
	maxTokens(min: number, max: number, defaultValue?: number): ModelBuilder;
	responseFormat(allowed?: readonly string[], defaultValue?: string): ModelBuilder;
	tools(defaultValue?: unknown[]): ModelBuilder;
	reasoningEffort(allowed: readonly string[], defaultValue: string): ModelBuilder;
	verbosity(allowed: readonly string[], defaultValue: string): ModelBuilder;
	build(): BuiltModel;
}

/**
 * Fluent builder for defining LLM models. Combines:
 * - LanguageModelData (seed/DB: pricing, limits, description)
 * - ModelConfig.parameters (API validation: temperature, max_tokens, etc.)
 */
export function model(name: string, vendor: AiVendor): ModelBuilder {
	return createModelBuilder(name, vendor);
}

/** Extract ModelConfig for ModelConfigService from built model */
export function toModelConfig(m: BuiltModel): ModelConfig {
	return {
		name: m.name,
		vendor: m.vendor,
		parameters: m.parameters,
	};
}

/** Extract seed/DB fields from built model (compatible with LanguageModelData) */
export function toLanguageModelData(m: BuiltModel): SeedModelFields {
	return {
		name: m.name,
		displayName: m.displayName,
		vendor: m.vendor,
		promptPrice: m.promptPrice,
		completionPrice: m.completionPrice,
		contextTokensMax: m.contextTokensMax,
		completionTokensMax: m.completionTokensMax,
		description: m.description,
	};
}
