import { useQuery } from "@tanstack/react-query";
import { organizationApi } from "@/api/organization";
import { useRefetchOnWorkspaceChange } from "@/hooks/useRefetchOnWorkspaceChange";
import { organizationKeys } from "@/query-keys/organization.keys";
import { isLocalAuth } from "@/lib/auth";

export function useGettingStartedQuota() {
	const isLocalInstance = isLocalAuth();
	const quotaQuery = useQuery({
		queryKey: organizationKeys.quota(),
		queryFn: () => organizationApi.getQuota(),
		refetchOnMount: "always",
		enabled: !isLocalInstance,
	});

	useRefetchOnWorkspaceChange(() => {
		if (isLocalInstance) return;
		void quotaQuery.refetch();
	});

	return {
		balance: quotaQuery.data?.quota?.balance ?? null,
		isLoading: quotaQuery.isLoading,
		errorMessage: quotaQuery.isError ? "Failed to load balance" : null,
	};
}
