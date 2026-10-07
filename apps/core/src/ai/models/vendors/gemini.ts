import { AiVendor } from "@/prisma";
import { model } from "../builder";
import type { BuiltModel, ListedPrices, PriceModifier } from "../builder";

/** Gemini defaults (all models share these) */
const GEMINI_RESPONSE_FORMAT = ["text", "json_schema"] as const;
const DEFAULT_RESPONSE_FORMAT = "text" as const;
const GEMINI_TEMPERATURE = [0, 2, 1] as const; // min, max, default

/**
 * Gemini 3.6, 3.7 and 3.8 Flash bill at half price through 2026-12-31 and at full price from
 * 2027-01-01. The listed (and displayed) price is the one in force when the registry was synced;
 * a run is billed at the one in force when it runs, so the switch needs no release.
 */
const FLASH_PROMO_ENDS = new Date("2027-01-01T00:00:00Z");
const FLASH_PROMO: ListedPrices = { prompt: 0.75, completion: 3.75, cacheRead: 0.075 };
const FLASH_STANDARD: ListedPrices = { prompt: 1.5, completion: 7.5, cacheRead: 0.15 };

function untilThenAfter(at: Date, until: ListedPrices, after: ListedPrices): PriceModifier {
	return () => (Date.now() < at.getTime() ? until : after);
}

/**
 * Google Gemini models. Single source of truth for both:
 * - Seed/DB (pricing, limits, description)
 * - API parameters (temperature, max_tokens, response_format, tools)
 */
export const GEMINI_MODELS: BuiltModel[] = [
	model("gemini-2.0-flash", AiVendor.GOOGLE)
		.retired("2026-06-01", "gemini-3-flash-preview")
		.displayName("Gemini 2.0 Flash")
		.description(
			"Delivers next-gen features and improved capabilities, including superior speed, native tool use, multimodal generation, and a 1M token context window.",
		)
		.pricing({ prompt: 0.1, completion: 0.7 })
		.limits(1_048_576, 8_192)
		.temperature(...GEMINI_TEMPERATURE)
		.maxTokens(1, 8_192)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-2.0-flash-lite", AiVendor.GOOGLE)
		.retired("2026-06-01", "gemini-3.1-flash-lite")
		.displayName("Gemini 2.0 Flash Lite")
		.description("A Gemini 2.0 Flash model optimized for cost efficiency and low latency.")
		.pricing({ prompt: 0.075, completion: 0.3 })
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
		.pricing({ prompt: 0.3, completion: 2.5, cacheRead: 0.03 })
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
		.pricing({ prompt: 1.25, completion: 10, cacheRead: 0.125 })
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-2.5-flash-lite", AiVendor.GOOGLE)
		.displayName("Gemini 2.5 Flash Lite")
		.description("A Gemini 2.5 Flash model optimized for cost efficiency and low latency.")
		.pricing({ prompt: 0.1, completion: 0.4, cacheRead: 0.01 })
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-3-pro-preview", AiVendor.GOOGLE)
		.retired("2026-03-09", "gemini-3.1-pro-preview")
		.displayName("Gemini 3 Pro Preview")
		.description(
			"Gemini 3 is our most intelligent model family to date, built on a foundation of state-of-the-art reasoning.",
		)
		.pricing({ prompt: 2, completion: 12 })
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.reasoningEffort(["low", "high"], "high")
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-3-flash-preview", AiVendor.GOOGLE)
		.displayName("Gemini 3 Flash Preview")
		.description(
			"Gemini 3 Flash Preview is a Gemini 3 model optimized for cost efficiency and low latency.",
		)
		.pricing({ prompt: 0.5, completion: 3, cacheRead: 0.05 })
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.reasoningEffort(["minimal", "low", "medium", "high"], "high")
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-3.1-flash-lite", AiVendor.GOOGLE)
		.deprecated("2027-05-07")
		.displayName("Gemini 3.1 Flash Lite")
		.description(
			"Frontier-class performance rivaling larger models at a fraction of the cost, optimized for low latency.",
		)
		.pricing({ prompt: 0.25, completion: 1.5, cacheRead: 0.025 })
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-3.1-pro-preview", AiVendor.GOOGLE)
		.displayName("Gemini 3.1 Pro Preview")
		.description(
			"Advanced intelligence, complex problem-solving, and powerful agentic coding capabilities with a 1M token context window.",
		)
		.pricing({ prompt: 2, completion: 12, cacheRead: 0.2 })
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.reasoningEffort(["low", "medium", "high"], "high")
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-3.5-flash-lite", AiVendor.GOOGLE)
		.displayName("Gemini 3.5 Flash-Lite")
		.description(
			"Google's most cost-efficient current model, recommended for new projects and high-volume, low-latency work.",
		)
		.pricing({ prompt: 0.3, completion: 2.5, cacheRead: 0.03 })
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.reasoningEffort(["minimal", "low", "medium", "high"], "minimal")
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-3.5-flash", AiVendor.GOOGLE)
		.displayName("Gemini 3.5 Flash")
		.description("A Gemini 3.5 model balancing intelligence, speed and cost.")
		.pricing({ prompt: 1.5, completion: 9, cacheRead: 0.15 })
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.reasoningEffort(["minimal", "low", "medium", "high"], "medium")
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-3.6-flash", AiVendor.GOOGLE)
		.displayName("Gemini 3.6 Flash")
		.description(
			"Fast, capable Flash model; Google's replacement for Gemini 3 Flash Preview. Half price through 2026.",
		)
		.pricing(FLASH_PROMO, untilThenAfter(FLASH_PROMO_ENDS, FLASH_PROMO, FLASH_STANDARD))
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.reasoningEffort(["minimal", "low", "medium", "high"], "medium")
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-3.7-flash", AiVendor.GOOGLE)
		.displayName("Gemini 3.7 Flash")
		.description("Fast, capable Flash model. Half price through 2026.")
		.pricing(FLASH_PROMO, untilThenAfter(FLASH_PROMO_ENDS, FLASH_PROMO, FLASH_STANDARD))
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		// "minimal" is rejected with an error on 3.7 and 3.8 Flash.
		.reasoningEffort(["low", "medium", "high"], "medium")
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gemini-3.8-flash", AiVendor.GOOGLE)
		.displayName("Gemini 3.8 Flash")
		.description(
			"Google's latest Flash model, recommended for new projects. Half price through 2026.",
		)
		.pricing(FLASH_PROMO, untilThenAfter(FLASH_PROMO_ENDS, FLASH_PROMO, FLASH_STANDARD))
		.limits(1_048_576, 65_536)
		.temperature(...GEMINI_TEMPERATURE)
		.reasoningEffort(["low", "medium", "high"], "medium")
		.maxTokens(1, 65_536)
		.responseFormat(GEMINI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),
];
