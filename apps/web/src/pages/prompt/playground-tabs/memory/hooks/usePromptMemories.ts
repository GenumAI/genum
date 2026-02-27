import { useQuery } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt/prompt.api";
import type { Memory } from "@/api/prompt/prompt.api";
import { memoryKeys } from "@/query-keys/memory.keys";

export const promptMemoriesQueryKey = (promptId: number | undefined) =>
	memoryKeys.promptMemories(promptId);

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
