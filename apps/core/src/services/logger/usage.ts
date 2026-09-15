import type { LogUsage } from "./types";

/**
 * A row with no usage: an error, a transcription, an ingested trace.
 *
 * Also the ONE list of usage fields. A fresh literal typed `LogUsage` fails type-check on a
 * missing field and on an extra one, and `sumUsage` sums exactly its keys. What that guards
 * against is a usage field reaching a trajectory's root row with the last turn's value instead
 * of the sum -- silently, and invisibly to any single-turn test.
 */
export const ZERO_USAGE: Readonly<LogUsage> = {
	tokens_in: 0,
	tokens_out: 0,
	tokens_sum: 0,
	cost: 0,
	response_ms: 0,
	tokens_in_cache_read: 0,
	tokens_in_cache_write: 0,
	tokens_out_reasoning: 0,
	cost_in_cache_read: 0,
	cost_in_cache_write: 0,
	cost_out_reasoning: 0,
};

const USAGE_FIELDS = Object.keys(ZERO_USAGE) as (keyof LogUsage)[];

/** Sums every usage field across a trajectory's turns. */
export function sumUsage(turns: readonly LogUsage[]): LogUsage {
	const total: LogUsage = { ...ZERO_USAGE };

	for (const field of USAGE_FIELDS) {
		total[field] = turns.reduce((sum, turn) => sum + turn[field], 0);
	}

	return total;
}
