import { useQuery, useQueryClient } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt";
import type { BranchesResponse } from "../utils/types";
import { versionKeys } from "@/query-keys/version.keys";

const SYSTEM_AUTHOR = {
	id: 0,
	name: "SYSTEM",
	email: "",
	picture: "",
};

export const useVersionsData = (id: string | undefined) => {
	const queryClient = useQueryClient();

	const branchesQuery = useQuery({
		queryKey: versionKeys.versions(id),
		queryFn: async () => {
			if (!id) throw new Error("No id");
			const result = await promptApi.getBranches(id);
			return {
				branches: result.branches.map((branch) => ({
					...branch,
					promptVersions: branch.promptVersions.map((version) => ({
						...version,
						author: version.author || SYSTEM_AUTHOR,
					})),
				})),
			} as BranchesResponse;
		},
		enabled: Boolean(id),
	});

	const promptQuery = useQuery({
		queryKey: versionKeys.committed(id),
		queryFn: async () => {
			if (!id) throw new Error("No id");
			const result = await promptApi.getPrompt(id);
			return result?.prompt?.commited ?? false;
		},
		enabled: Boolean(id),
	});

	const refresh = () => {
		if (!id) return;
		queryClient.invalidateQueries({ queryKey: versionKeys.versions(id) });
		queryClient.invalidateQueries({ queryKey: versionKeys.committed(id) });
	};

	const isCommitted = promptQuery.data ?? false;
	const setIsCommitted = (value: boolean) => {
		queryClient.setQueryData(versionKeys.committed(id), value);
	};

	return {
		data: branchesQuery.data ?? null,
		isLoading: branchesQuery.isLoading,
		isCommitted,
		setIsCommitted,
		refresh,
	};
};
