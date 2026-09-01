import { useQuery } from "@tanstack/react-query";
import { placeholderApi } from "@/api/prompt/placeholder.api";
import type { PromptPlaceholder } from "@/api/prompt/placeholder.api";
import { placeholderKeys } from "@/query-keys/placeholder.keys";

export const promptPlaceholdersQueryKey = (promptId: number | undefined) =>
	placeholderKeys.promptPlaceholders(promptId);

export const usePromptPlaceholders = (
	promptIdProp: number | string | undefined,
	isActive = true,
) => {
	const promptId = promptIdProp ? Number(promptIdProp) : undefined;

	return useQuery<PromptPlaceholder[]>({
		queryKey: promptPlaceholdersQueryKey(promptId),
		queryFn: async () => {
			if (!promptId) return [];
			const response = await placeholderApi.getPromptPlaceholders(promptId);
			return response.placeholders || [];
		},
		enabled: !!promptId && isActive,
	});
};
