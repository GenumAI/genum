import type { Log } from "@/types/logs";

/**
 * A price per 1M tokens, to as many decimals as a cache price needs. `toFixed(2)` would show
 * gpt-5-nano's $0.005 as $0.01 and a $0.025 cache price as $0.03. A sub-dollar price is shown to
 * 3 decimals with trailing zeros trimmed, but never below the cent -- $0.50, not $0.500 or $0.5.
 */
export function formatPricePerMillion(price: number): string {
	if (price >= 1) {
		return price.toFixed(2);
	}

	return price.toFixed(3).replace(/(\.\d{2}\d*?)0+$/, "$1");
}

export type SplitLine = { label: string; value: number };

/**
 * The parts of a usage total worth a line: only those greater than zero. A zero part is never
 * shown -- on a row written before the split was recorded it means "not recorded", on a new row
 * it means "none", and neither is worth a line.
 */
export function splitLines(
	parts: ReadonlyArray<{ label: string; value: number | undefined }>,
): SplitLine[] {
	return parts.filter((part): part is SplitLine => part.value !== undefined && part.value > 0);
}

export function logTokenSplit(log: Log): SplitLine[] {
	return splitLines([
		{ label: "Cache read", value: log.tokens_in_cache_read },
		{ label: "Cache write", value: log.tokens_in_cache_write },
		{ label: "Reasoning", value: log.tokens_out_reasoning },
	]);
}

export function logCostSplit(log: Log): SplitLine[] {
	return splitLines([
		{ label: "Cache read", value: log.cost_in_cache_read },
		{ label: "Cache write", value: log.cost_in_cache_write },
		{ label: "Reasoning", value: log.cost_out_reasoning },
	]);
}
