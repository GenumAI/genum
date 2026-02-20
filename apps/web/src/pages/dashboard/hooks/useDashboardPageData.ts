import { useState } from "react";
import type { LogsFilterState } from "@/pages/logs/components/LogsFilter";
import { useProjectUsage } from "@/pages/dashboard/hooks/useProjectUsage";
import {
	getDefaultDashboardDateRange,
	getUsageDateParams,
} from "@/pages/dashboard/utils/dateRange";
import { useRefetchOnWorkspaceChange } from "@/hooks/useRefetchOnWorkspaceChange";

export function useDashboardPageData() {
	const [filter, setFilter] = useState<LogsFilterState>({
		dateRange: getDefaultDashboardDateRange(),
	});

	const { fromDate, toDate } = getUsageDateParams(filter);
	const usageQuery = useProjectUsage(fromDate, toDate);

	useRefetchOnWorkspaceChange(() => {
		void usageQuery.refetch();
	});

	return {
		filter,
		setFilter,
		data: usageQuery.data,
		isLoading: usageQuery.isLoading,
	};
}
