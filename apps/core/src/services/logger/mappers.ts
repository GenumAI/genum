/**
 * Pure mappers from ClickHouse rows to service-level stats.
 * Kept free of env/client imports so they stay unit-testable.
 */

import moment from "moment";
import type { ApiKeyUsageStats, ClickHouseApiKeyStatsRow } from "./types";

// ClickHouse returns aggregates as strings, so every numeric field is coerced here
export function mapApiKeyStatsRow(row: ClickHouseApiKeyStatsRow): ApiKeyUsageStats {
	return {
		api_key_id: Number(row.api_key_id),
		total_requests: Number(row.total_requests || 0),
		total_tokens_sum: Number(row.total_tokens_sum || 0),
		total_cost: Number(row.total_cost || 0),
		last_activity: row.last_activity ? moment(row.last_activity).toISOString() : null,
	};
}

export function toLogPlaceholders(resolved: Record<string, string | null>): Record<string, string> {
	return Object.fromEntries(Object.entries(resolved).map(([key, name]) => [key, name ?? ""]));
}

export function resolveLogPlaceholders(row: {
	placeholders?: Record<string, string>;
	memory_key?: string | null;
}): Record<string, string> | undefined {
	if (row.placeholders && Object.keys(row.placeholders).length > 0) {
		return row.placeholders;
	}
	if (row.memory_key) {
		return { memory_key: row.memory_key };
	}
	return undefined;
}
