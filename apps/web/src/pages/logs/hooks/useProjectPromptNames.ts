import { useQuery } from "@tanstack/react-query";

import { promptApi } from "@/api/prompt";
import type { PromptName } from "@/types/logs";

export function useProjectPromptNames() {
	const promptsQuery = useQuery<{ prompts: PromptName[] }>({
		queryKey: ["project-prompt-names"],
		refetchOnMount: "always",
		queryFn: async () => {
			return promptApi.getPrompts();
		},
	});

	return {
		promptNames: promptsQuery.data?.prompts ?? [],
		isFetchingPromptNames: promptsQuery.isFetching,
		isPromptNamesError: promptsQuery.isError,
		refetchPromptNames: promptsQuery.refetch,
	};
}
