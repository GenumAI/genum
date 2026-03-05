import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UsageData } from "@/api/project/project.api";
import { projectApi } from "@/api/project";
import { getOrgId, getProjectId } from "@/api/client";
import { projectKeys } from "@/query-keys/project.keys";

export const useProjectUsage = (fromDate: string, toDate: string) => {
	const orgId = getOrgId();
	const projectId = getProjectId();

	const usageQuery = useQuery<UsageData>({
		queryKey: projectKeys.usage(orgId, projectId, fromDate, toDate),
		enabled: Boolean(orgId && projectId && fromDate && toDate),
		placeholderData: keepPreviousData,
		queryFn: async () => {
			return projectApi.getUsage(fromDate, toDate);
		},
	});

	return {
		data: usageQuery.data,
		isLoading: usageQuery.isPending,
		error: usageQuery.error,
		isError: usageQuery.isError,
		refetch: usageQuery.refetch,
	};
};
