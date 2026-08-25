import { AiVendor } from "@/prisma";
import { model } from "../builder";
import type { BuiltModel, PriceModifier } from "../builder";
import type { Prices } from "../pricing";

/** DeepSeek defaults (all models share these) */
const DEEPSEEK_RESPONSE_FORMAT = ["text", "json_object"] as const;
const DEFAULT_RESPONSE_FORMAT = "text" as const;
const DEEPSEEK_TEMPERATURE = [0, 2, 1] as const; // min, max, default
const DEEPSEEK_REASONING_EFFORT = ["low", "high", "max"] as const;
const DEEPSEEK_CONTEXT_MAX = 1_000_000;
const DEEPSEEK_COMPLETION_MAX = 384_000;

/**
 * Hours (UTC) during which DeepSeek bills the standard rate. Everything else — including
 * all of Saturday and Sunday — is off-peak and billed at half price.
 * Source: https://api-docs.deepseek.com/quick_start/pricing
 */
const DEEPSEEK_PEAK_WINDOWS_UTC = [
	{ from: 1, to: 4 },
	{ from: 6, to: 10 },
] as const;

export function isDeepSeekPeak(at: Date): boolean {
	const weekday = at.getUTCDay();
	if (weekday === 0 || weekday === 6) {
		return false;
	}

	const hour = at.getUTCHours() + at.getUTCMinutes() / 60;

	return DEEPSEEK_PEAK_WINDOWS_UTC.some((window) => hour >= window.from && hour < window.to);
}

/** Bills at `peak` during DeepSeek's peak windows and at `offPeak` the rest of the time. */
function timeOfDayPricing(peak: Prices, offPeak: Prices): PriceModifier {
	return () => (isDeepSeekPeak(new Date()) ? peak : offPeak);
}

/**
 * DeepSeek models. Single source of truth for both:
 * - Seed/DB (pricing, limits, description)
 * - API parameters (temperature, max_tokens, response_format, tools, reasoning_effort)
 *
 * `.pricing()` carries the peak rate, so the price shown in the UI is the maximum a run
 * can cost. The modifier resolves the actual rate when the run is billed.
 */
export const DEEPSEEK_MODELS: BuiltModel[] = [
	model("deepseek-v4-flash", AiVendor.DEEPSEEK)
		.displayName("DeepSeek V4 Flash")
		.description(
			"DeepSeek's cost-efficient model for high-volume workloads, with a 1M token context window. Off-peak runs are billed at half the listed price.",
		)
		.pricing(
			0.44,
			1.32,
			timeOfDayPricing(
				{ prompt: 0.44, completion: 1.32 },
				{ prompt: 0.22, completion: 0.66 },
			),
		)
		.limits(DEEPSEEK_CONTEXT_MAX, DEEPSEEK_COMPLETION_MAX)
		.temperature(...DEEPSEEK_TEMPERATURE)
		.maxTokens(1, DEEPSEEK_COMPLETION_MAX)
		.responseFormat(DEEPSEEK_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.reasoningEffort(DEEPSEEK_REASONING_EFFORT, "high")
		.tools()
		.build(),

	model("deepseek-v4-pro", AiVendor.DEEPSEEK)
		.displayName("DeepSeek V4 Pro")
		.description(
			"DeepSeek's highest-capability model, with a 1M token context window. Off-peak runs are billed at half the listed price.",
		)
		.pricing(
			1.32,
			3.96,
			timeOfDayPricing(
				{ prompt: 1.32, completion: 3.96 },
				{ prompt: 0.66, completion: 1.98 },
			),
		)
		.limits(DEEPSEEK_CONTEXT_MAX, DEEPSEEK_COMPLETION_MAX)
		.temperature(...DEEPSEEK_TEMPERATURE)
		.maxTokens(1, DEEPSEEK_COMPLETION_MAX)
		.responseFormat(DEEPSEEK_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.reasoningEffort(DEEPSEEK_REASONING_EFFORT, "high")
		.tools()
		.build(),
];
