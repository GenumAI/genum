import type { AiVendor } from "@/prisma";
import type { BuiltModel, ListedPrices } from "./builder";
import { ALL_MODELS } from "./vendors";

/**
 * The prices one run is billed at, in USD per 1M tokens. Unlike `ListedPrices`, nothing here is
 * optional: a cache price the vendor does not publish has already fallen back to the prompt
 * price, so a cached token is never billed below what it was before cache prices existed.
 */
export type Prices = { prompt: number; completion: number; cacheRead: number; cacheWrite: number };

/** The fields of a `LanguageModel` row that pricing reads. */
export type PricedModel = {
	vendor: AiVendor;
	name: string;
	promptPrice: number;
	completionPrice: number;
};

export function findRegistryModel(vendor: AiVendor, name: string): BuiltModel | undefined {
	return ALL_MODELS.find((m) => m.name === name && m.vendor === vendor);
}

function resolve(listed: ListedPrices): Prices {
	return {
		prompt: listed.prompt,
		completion: listed.completion,
		cacheRead: listed.cacheRead ?? listed.prompt,
		cacheWrite: listed.cacheWrite ?? listed.prompt,
	};
}

/**
 * Resolves the prices a run should be billed at, in USD per 1M tokens.
 *
 * Base prices come from the model row, which the registry sync keeps equal to the registry for
 * every registry model. Cache prices come from the registry alone — they are code-side only.
 * A model whose registry entry declares a `priceModifier` resolves all of its prices at call
 * time instead: DeepSeek halves them outside its peak hours.
 *
 * Models absent from the registry (custom OpenAI-compatible providers, models seeded by an
 * older release) bill at the row's prices, with cache tokens at the prompt price.
 */
export function getEffectivePrices(model: PricedModel): Prices {
	const registered = findRegistryModel(model.vendor, model.name);

	if (registered?.priceModifier) {
		return resolve(registered.priceModifier());
	}

	return resolve({
		prompt: model.promptPrice,
		completion: model.completionPrice,
		cacheRead: registered?.cacheReadPrice,
		cacheWrite: registered?.cacheWritePrice,
	});
}

/**
 * A model row with the cache prices the registry lists, for display. `null` where none is
 * listed, which a reader shows as "no cache price", never as free.
 */
export function withCachePrices<T extends { vendor: AiVendor; name: string }>(
	model: T,
): T & { cacheReadPrice: number | null; cacheWritePrice: number | null } {
	const registered = findRegistryModel(model.vendor, model.name);

	return {
		...model,
		cacheReadPrice: registered?.cacheReadPrice ?? null,
		cacheWritePrice: registered?.cacheWritePrice ?? null,
	};
}
