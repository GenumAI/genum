import { useQuery, useQueryClient } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt";
import type { BranchesResponse } from "../utils/types";
import { versionKeys } from "@/query-keys/version.keys";
import { promptKeys } from "@/query-keys/prompt.keys";

type PromptByIdQueryData = {
	prompt?: {
		commited?: boolean;
	};
};

const SYSTEM_AUTHOR = {
	id: 0,
	name: "SYSTEM",
	email: "",
	picture: "",
};

export const useVersionsData = (id: string | undefined, isActive = true) => {
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
		enabled: Boolean(id && isActive),
		staleTime: Infinity,
		gcTime: Infinity,
	});

	const promptQuery = useQuery({
		queryKey: promptKeys.byId(id),
		queryFn: async () => {
			if (!id) throw new Error("No id");
			return promptApi.getPrompt(id);
		},
		enabled: Boolean(id && isActive),
	});

	const refresh = () => {
		if (!id) return;
		queryClient.invalidateQueries({ queryKey: versionKeys.versions(id) });
		queryClient.invalidateQueries({ queryKey: promptKeys.byId(id) });
	};

	const isCommitted = promptQuery.data?.prompt?.commited ?? false;
	const setIsCommitted = (value: boolean) => {
		queryClient.setQueryData<PromptByIdQueryData | undefined>(
			promptKeys.byId(id),
			(previous) => {
				if (!previous?.prompt) return previous;
				return {
					...previous,
					prompt: {
						...previous.prompt,
						commited: value,
					},
				};
			},
		);
	};

	return {
		data: branchesQuery.data ?? null,
		isLoading: branchesQuery.isLoading,
		isCommitted,
		setIsCommitted,
		refresh,
	};
};
