import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { projectApi } from "@/api/project";
import { promptApi } from "@/api/prompt";
import type { LogsFilterState } from "@/pages/logs/components/LogsFilter";
import type { LogsResponse, MemoriesResponse } from "@/types/logs";

interface UseProjectLogsDataParams {
	page: number;
	pageSize: number;
	logsFilter: LogsFilterState;
	selectedPromptId?: number;
	shouldFetchMemories?: boolean;
}

export function useProjectLogsData({
	page,
	pageSize,
	logsFilter,
	selectedPromptId,
	shouldFetchMemories = false,
}: UseProjectLogsDataParams) {
	const fromDate = logsFilter.dateRange?.from?.toISOString();
	const toDate = logsFilter.dateRange?.to?.toISOString();
	const logLevel =
		logsFilter.logLevel && logsFilter.logLevel !== "all" ? logsFilter.logLevel : undefined;
	const model = logsFilter.model && logsFilter.model !== "all" ? logsFilter.model : undefined;
	const source = logsFilter.source || undefined;
	const query = logsFilter.query || undefined;
	const promptId = logsFilter.promptId || undefined;

	const logsQuery = useQuery<LogsResponse>({
		queryKey: [
			"project-logs",
			page,
			pageSize,
			fromDate,
			toDate,
			logLevel,
			model,
			source,
			query,
			promptId,
		],
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

	const memoriesQuery = useQuery<MemoriesResponse>({
		queryKey: ["project-logs-memories", selectedPromptId],
		enabled: Boolean(selectedPromptId && shouldFetchMemories),
		refetchOnMount: "always",
		queryFn: async () => {
			return promptApi.getMemories(selectedPromptId as number) as Promise<MemoriesResponse>;
		},
	});

	const isInitialLoadingLogs = logsQuery.isPending && !logsQuery.data;

	return {
		logs: logsQuery.data?.logs ?? [],
		total: logsQuery.data?.total ?? 0,
		memoriesData: memoriesQuery.data,
		isFetchingLogs: logsQuery.isFetching,
		isInitialLoadingLogs,
		logsError: logsQuery.error,
		isLogsError: logsQuery.isError,
		refetchLogs: logsQuery.refetch,
		refetchMemories: memoriesQuery.refetch,
	};
}
