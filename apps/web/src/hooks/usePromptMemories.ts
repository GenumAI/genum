import { useQuery } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt/prompt.api";
import type { Memory } from "@/api/prompt/prompt.api";

export const PROMPT_MEMORIES_QUERY_KEY = "prompt-memories";

export const promptMemoriesQueryKey = (promptId: number | undefined) => [
	PROMPT_MEMORIES_QUERY_KEY,
	promptId,
];

export const usePromptMemories = (promptIdProp: number | string | undefined) => {
	const promptId = promptIdProp ? Number(promptIdProp) : undefined;

	return useQuery<Memory[]>({
		queryKey: promptMemoriesQueryKey(promptId),
		queryFn: async () => {
			if (!promptId) return [];
			const response = await promptApi.getMemories(promptId);
			return response.memories || [];
		},
		enabled: !!promptId,
	});
};
