import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { promptApi } from "@/api/prompt";
import type { LogsFilterState } from "@/pages/logs/components/LogsFilter";
import type { LogsResponse } from "@/types/logs";
import { logsKeys } from "@/query-keys/logs.keys";

interface UseLogsDataParams {
	promptId?: number;
	page: number;
	pageSize: number;
	logsFilter: LogsFilterState;
	isActive?: boolean;
}

export function useLogsData({
	promptId,
	page,
	pageSize,
	logsFilter,
	isActive = true,
}: UseLogsDataParams) {
	const fromDate = logsFilter.dateRange?.from?.toISOString();
	const toDate = logsFilter.dateRange?.to?.toISOString();
	const logLevel = logsFilter.logLevel || undefined;
	const model = logsFilter.model || undefined;
	const source = logsFilter.source || undefined;
	const query = logsFilter.query || undefined;

	const logsQuery = useQuery<LogsResponse>({
		queryKey: logsKeys.promptLogs({
			promptId,
			page,
			pageSize,
			fromDate,
			toDate,
			logLevel,
			model,
			source,
			query,
		}),
		enabled: Boolean(promptId && isActive),
		placeholderData: keepPreviousData,
		queryFn: async () => {
			return promptApi.getLogs(promptId as number, {
				page,
				pageSize,
				fromDate,
				toDate,
				logLevel,
				model,
				source,
				query,
			});
		},
	});

	const logs = useMemo(() => logsQuery.data?.logs ?? [], [logsQuery.data]);
	const total = logsQuery.data?.total ?? 0;
	const isInitialLoadingLogs = logsQuery.isPending && !logsQuery.data;

	return {
		logs,
		total,
		logsData: logsQuery.data,
		isFetchingLogs: logsQuery.isFetching,
		isInitialLoadingLogs,
		logsError: logsQuery.error,
		isLogsError: logsQuery.isError,
		refetchLogs: logsQuery.refetch,
	};
}
