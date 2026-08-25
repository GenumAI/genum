import type { AiVendor } from "@/prisma";
import { ALL_MODELS } from "./vendors";

export type Prices = { prompt: number; completion: number };

/**
 * Resolves the prices a run should be billed at, in USD per 1M tokens.
 *
 * `LanguageModel` stores a single static price pair, which is all most vendors need.
 * A model whose registry entry declares a `priceModifier` (see `PriceModifier`) resolves
 * its prices at call time instead — DeepSeek halves both prices outside its peak hours.
 *
 * Models absent from the registry (custom OpenAI-compatible providers, models seeded by
 * an older release) fall back to the prices passed in, so behaviour is unchanged for them.
 */
export function getEffectivePrices(
	vendor: AiVendor,
	name: string,
	promptPrice: number,
	completionPrice: number,
): Prices {
	const model = ALL_MODELS.find((m) => m.name === name && m.vendor === vendor);

	return model?.priceModifier?.() ?? { prompt: promptPrice, completion: completionPrice };
}
