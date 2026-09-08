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

/** The shape ClickHouse renders a `DateTime64(3)` in, and the only one it parses back. */
const CLICKHOUSE_TIMESTAMP = "YYYY-MM-DD HH:mm:ss.SSS";

/**
 * ClickHouse renders `DateTime64(3)` without a zone -- "2026-09-07 15:41:25.368". Handing
 * that to `new Date()` reads it in the PROCESS timezone, so the same row came back as a
 * different instant depending on where the server ran, and a detail lookup keyed on the
 * timestamp it returned would miss by the offset. The columns carry no zone because the
 * ClickHouse server keeps them in UTC, so UTC is what parses them.
 */
export function parseClickHouseTimestamp(value: string): Date {
	return value ? moment.utc(value, CLICKHOUSE_TIMESTAMP).toDate() : new Date();
}

/** The inverse: an instant back into the literal a `DateTime64(3)` parameter accepts. */
export function formatClickHouseTimestamp(value: Date): string {
	return moment.utc(value).format(CLICKHOUSE_TIMESTAMP);
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
