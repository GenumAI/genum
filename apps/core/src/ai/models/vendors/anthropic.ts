import { AiVendor } from "@/prisma";
import { model } from "../builder";
import type { BuiltModel } from "../builder";

/** Anthropic defaults (all models share these) */
const ANTHROPIC_TEMPERATURE = [0, 1, 0.5] as const; // min, max, default
const ANTHROPIC_MAX_TOKENS = 64_000; // default = max, omitted in builder

/**
 * Anthropic models. Single source of truth for both:
 * - Seed/DB (pricing, limits, description)
 * - API parameters (temperature, max_tokens, tools)
 */
export const ANTHROPIC_MODELS: BuiltModel[] = [
	model("claude-3-7-sonnet-latest", AiVendor.ANTHROPIC)
		.displayName("Claude Sonnet 3.7")
		.description(
			"First hybrid reasoning model on the market. Offers both quick responses and extended, step-by-step reasoning. Enhanced coding and front-end web development capabilities",
		)
		.pricing(3, 15)
		.limits(200_000, 64_000)
		.temperature(...ANTHROPIC_TEMPERATURE)
		.maxTokens(1, ANTHROPIC_MAX_TOKENS)
		.tools()
		.build(),

	model("claude-sonnet-4-0", AiVendor.ANTHROPIC)
		.displayName("Claude Sonnet 4.0")
		.description(
			"Balances performance and efficiency for internal and external use cases, with enhanced steerability for greater control over implementations. While not matching Opus 4 in most domains, it delivers an optimal mix of capability and practicality.",
		)
		.pricing(3, 15)
		.limits(200_000, 64_000)
		.temperature(...ANTHROPIC_TEMPERATURE)
		.maxTokens(1, ANTHROPIC_MAX_TOKENS)
		.tools()
		.build(),

	model("claude-sonnet-4-5", AiVendor.ANTHROPIC)
		.displayName("Claude Sonnet 4.5")
		.description("Best model for complex agents and coding")
		.pricing(3, 15)
		.limits(200_000, 64_000)
		.temperature(...ANTHROPIC_TEMPERATURE)
		.maxTokens(1, ANTHROPIC_MAX_TOKENS)
		.tools()
		.build(),

	model("claude-haiku-4-5", AiVendor.ANTHROPIC)
		.displayName("Claude Haiku 4.5")
		.description(
			"Claude Haiku is a model for fast, effective reasoning with exceptionally efficient performance in coding and visual tasks.",
		)
		.pricing(1, 5)
		.limits(200_000, 64_000)
		.temperature(...ANTHROPIC_TEMPERATURE)
		.maxTokens(1, ANTHROPIC_MAX_TOKENS)
		.tools()
		.build(),
];
