import { addDays, format } from "date-fns";
import type { LogsFilterState } from "@/pages/logs/components/LogsFilter";

const DEFAULT_DASHBOARD_RANGE_DAYS = 30;

export function getDefaultDashboardDateRange() {
	const to = new Date();
	return {
		from: addDays(to, -DEFAULT_DASHBOARD_RANGE_DAYS),
		to,
	};
}

export function getUsageDateParams(filter: LogsFilterState) {
	const defaultRange = getDefaultDashboardDateRange();
	const from = filter.dateRange?.from ?? defaultRange.from;
	const to = filter.dateRange?.to ?? defaultRange.to;

	return {
		fromDate: format(from, "yyyy-MM-dd"),
		toDate: format(to, "yyyy-MM-dd"),
	};
}
