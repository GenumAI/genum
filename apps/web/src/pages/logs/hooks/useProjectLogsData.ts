import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { projectApi } from "@/api/project";
import type { LogsFilterState } from "@/pages/logs/components/LogsFilter";
import type { LogsResponse } from "@/types/logs";
import { logsKeys } from "@/query-keys/logs.keys";

interface UseProjectLogsDataParams {
	page: number;
	pageSize: number;
	logsFilter: LogsFilterState;
}

export function useProjectLogsData({ page, pageSize, logsFilter }: UseProjectLogsDataParams) {
	const fromDate = logsFilter.dateRange?.from?.toISOString();
	const toDate = logsFilter.dateRange?.to?.toISOString();
	const logLevel =
		logsFilter.logLevel && logsFilter.logLevel !== "all" ? logsFilter.logLevel : undefined;
	const model = logsFilter.model && logsFilter.model !== "all" ? logsFilter.model : undefined;
	const source = logsFilter.source || undefined;
	const query = logsFilter.query || undefined;
	const promptId = logsFilter.promptId || undefined;

	const logsQuery = useQuery<LogsResponse>({
		queryKey: logsKeys.projectLogs({
			page,
			pageSize,
			fromDate,
			toDate,
			logLevel,
			model,
			source,
			query,
			promptId,
		}),
		refetchOnMount: "always",
		placeholderData: keepPreviousData,
		queryFn: async () => {
			return projectApi.getLogs({
				page,
				pageSize,
				fromDate,
				toDate,
				logLevel,
				model,
				source,
				query,
				promptId,
			});
		},
	});

	const isInitialLoadingLogs = logsQuery.isPending && !logsQuery.data;

	return {
		logs: logsQuery.data?.logs ?? [],
		total: logsQuery.data?.total ?? 0,
		isFetchingLogs: logsQuery.isFetching,
		isInitialLoadingLogs,
		logsError: logsQuery.error,
		isLogsError: logsQuery.isError,
		refetchLogs: logsQuery.refetch,
	};
}
