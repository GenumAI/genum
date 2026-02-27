import { useQuery } from "@tanstack/react-query";
import { organizationApi } from "@/api/organization";
import { useRefetchOnWorkspaceChange } from "@/hooks/useRefetchOnWorkspaceChange";
import { organizationKeys } from "@/query-keys/organization.keys";

export function useGettingStartedQuota() {
	const quotaQuery = useQuery({
		queryKey: organizationKeys.quota(),
		queryFn: () => organizationApi.getQuota(),
		refetchOnMount: "always",
	});

	useRefetchOnWorkspaceChange(() => {
		void quotaQuery.refetch();
	});

	return {
		balance: quotaQuery.data?.quota?.balance ?? null,
		isLoading: quotaQuery.isLoading,
		errorMessage: quotaQuery.isError ? "Failed to load balance" : null,
	};
}
