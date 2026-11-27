import { addDays } from "date-fns";
import type { LogsFilterState } from "@/pages/logs/components/LogsFilter";
import { toRequestDateRange } from "@/pages/logs/utils/logsFilterUtils";

const DEFAULT_DASHBOARD_RANGE_DAYS = 30;

export function getDefaultDashboardDateRange() {
	const to = new Date();
	return {
		from: addDays(to, -DEFAULT_DASHBOARD_RANGE_DAYS),
		to,
	};
}

/**
 * Instants, not `yyyy-MM-dd`. The server reads a bare day as UTC midnight and filters
 * `timestamp <= toDate` exactly, so a day string for today cut every run made today.
 */
export function getUsageDateParams(filter: LogsFilterState) {
	const defaultRange = getDefaultDashboardDateRange();
	const { fromDate, toDate } = toRequestDateRange({
		from: filter.dateRange?.from ?? defaultRange.from,
		to: filter.dateRange?.to ?? defaultRange.to,
	});

	return { fromDate: fromDate ?? "", toDate: toDate ?? "" };
}
