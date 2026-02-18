import { useQuery, useQueryClient } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt";
import type { BranchesResponse } from "../utils/types";

const SYSTEM_AUTHOR = {
	id: 0,
	name: "SYSTEM",
	email: "",
	picture: "",
};

export const VERSIONS_QUERY_KEY = ["versions"] as const;
export const PROMPT_COMMITTED_QUERY_KEY = ["prompt-committed"] as const;

export const useVersionsData = (id: string | undefined) => {
	const queryClient = useQueryClient();

	const branchesQuery = useQuery({
		queryKey: [...VERSIONS_QUERY_KEY, id],
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
		queryKey: [...PROMPT_COMMITTED_QUERY_KEY, id],
		queryFn: async () => {
			if (!id) throw new Error("No id");
			const result = await promptApi.getPrompt(id);
			return result?.prompt?.commited ?? false;
		},
		enabled: Boolean(id),
	});

	const refresh = () => {
		if (!id) return;
		queryClient.invalidateQueries({ queryKey: [...VERSIONS_QUERY_KEY, id] });
		queryClient.invalidateQueries({ queryKey: [...PROMPT_COMMITTED_QUERY_KEY, id] });
	};

	const isCommitted = promptQuery.data ?? false;
	const setIsCommitted = (value: boolean) => {
		queryClient.setQueryData([...PROMPT_COMMITTED_QUERY_KEY, id], value);
	};

	return {
		data: branchesQuery.data ?? null,
		isLoading: branchesQuery.isLoading,
		isCommitted,
		setIsCommitted,
		refresh,
	};
};
