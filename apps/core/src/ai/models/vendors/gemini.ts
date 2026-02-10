import { AiVendor } from "@/prisma";
import { model } from "../builder";
import type { BuiltModel } from "../builder";

/** Gemini defaults (all models share these) */
const GEMINI_RESPONSE_FORMAT = ["text", "json_schema"] as const;
const DEFAULT_RESPONSE_FORMAT = "text" as const;
const GEMINI_TEMPERATURE = [0, 2, 1] as const; // min, max, default

/**
 * Google Gemini models. Single source of truth for both:
 * - Seed/DB (pricing, limits, description)
 * - API parameters (temperature, max_tokens, response_format, tools)
 */
export const GEMINI_MODELS: BuiltModel[] = [
	model("gemini-2.0-flash", AiVendor.GOOGLE)
		.displayName("Gemini 2.0 Flash")
		.description(
			"Delivers next-gen features and improved capabilities, including superior speed, native tool use, multimodal generation, and a 1M token context window.",
		)
		.pricing(0.1, 0.7)
		.limits(1_048_576, 8_192)
		.temperature(...GEMINI_TEMPERATURE)
		.maxTokens(1, 8_192)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-2.0-flash-lite", AiVendor.GOOGLE)
		.displayName("Gemini 2.0 Flash Lite")
		.description(
			"A Gemini 2.0 Flash model optimized for cost efficiency and low latency.",
		)
		.pricing(0.075, 0.3)
		.limits(1_048_576, 8_192)
		.temperature(...GEMINI_TEMPERATURE)
		.maxTokens(1, 8_192)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-2.5-flash", AiVendor.GOOGLE)
		.displayName("Gemini 2.5 Flash")
		.description(
			"Gemini 2.5 Flash is Google's best model in terms of price-performance, offering well-rounded capabilities.",
		)
		.pricing(0.3, 2.5)
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-2.5-pro", AiVendor.GOOGLE)
		.displayName("Gemini 2.5 Pro")
		.description(
			"Gemini 2.5 Pro is Google's state-of-the-art thinking model, capable of reasoning over complex problems in code, math, and STEM, as well as analyzing large datasets, codebases, and documents using long context.",
		)
		.pricing(1.25, 10)
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-2.5-flash-lite", AiVendor.GOOGLE)
		.displayName("Gemini 2.5 Flash Lite")
		.description(
			"A Gemini 2.5 Flash model optimized for cost efficiency and low latency.",
		)
		.pricing(0.1, 0.4)
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-3-pro-preview", AiVendor.GOOGLE)
		.displayName("Gemini 3 Pro Preview")
		.description(
			"Gemini 3 is our most intelligent model family to date, built on a foundation of state-of-the-art reasoning.",
		)
		.pricing(2, 12)
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),
];
