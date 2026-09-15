/**
 * A price per 1M tokens, to as many decimals as a cache price needs. `toFixed(2)` would show
 * gpt-5-nano's $0.005 as $0.01 and a $0.025 cache price as $0.03.
 */
export function formatPricePerMillion(price: number): string {
	return price.toFixed(price < 1 ? 3 : 2);
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
