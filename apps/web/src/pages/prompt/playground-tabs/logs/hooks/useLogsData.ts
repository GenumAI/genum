import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { promptApi } from "@/api/prompt";
import type { LogsFilterState } from "@/pages/logs/components/LogsFilter";
import type { LogsResponse, MemoriesResponse } from "@/types/logs";

interface UseLogsDataParams {
	promptId?: number;
	page: number;
	pageSize: number;
	logsFilter: LogsFilterState;
	shouldFetchMemories?: boolean;
}

export function useLogsData({
	promptId,
	page,
	pageSize,
	logsFilter,
	shouldFetchMemories = false,
}: UseLogsDataParams) {
	const fromDate = logsFilter.dateRange?.from?.toISOString();
	const toDate = logsFilter.dateRange?.to?.toISOString();
	const logLevel = logsFilter.logLevel || undefined;
	const model = logsFilter.model || undefined;
	const source = logsFilter.source || undefined;
	const query = logsFilter.query || undefined;

	const logsQuery = useQuery<LogsResponse>({
		queryKey: [
			"prompt-logs-tab",
			promptId,
			page,
			pageSize,
			fromDate,
			toDate,
			logLevel,
			model,
			source,
			query,
		],
		enabled: Boolean(promptId),
		refetchOnMount: "always",
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

	const memoriesQuery = useQuery<MemoriesResponse>({
		queryKey: ["prompt-memories-tab", promptId],
		enabled: Boolean(promptId && shouldFetchMemories),
		refetchOnMount: "always",
		queryFn: async () => {
			return promptApi.getMemories(promptId as number) as Promise<MemoriesResponse>;
		},
	});

	const logs = useMemo(() => logsQuery.data?.logs ?? [], [logsQuery.data]);
	const total = logsQuery.data?.total ?? 0;
	const isInitialLoadingLogs = logsQuery.isPending && !logsQuery.data;

	return {
		logs,
		total,
		logsData: logsQuery.data,
		memoriesData: memoriesQuery.data,
		isFetchingLogs: logsQuery.isFetching,
		isInitialLoadingLogs,
		logsError: logsQuery.error,
		isLogsError: logsQuery.isError,
		isFetchingMemories: memoriesQuery.isFetching,
		refetchLogs: logsQuery.refetch,
		refetchMemories: memoriesQuery.refetch,
	};
}
