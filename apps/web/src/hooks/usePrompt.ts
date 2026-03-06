import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PromptSettings } from "@/types/Prompt";
import { promptApi } from "@/api/prompt";
import { promptKeys } from "@/query-keys/prompt.keys";

export type Options = { isWithoutUpdate: boolean };

type PromptResponse = {
	prompt: PromptSettings;
};

const getErrorMessage = (error: unknown, fallback: string) => {
	if (error instanceof Error) return error.message;
	return fallback;
};

export function usePromptById(promptId: number | string | undefined) {
	const queryClient = useQueryClient();
	const queryKey = promptKeys.byId(promptId);

	const promptQuery = useQuery<PromptResponse>({
		queryKey,
		queryFn: async () => {
			if (!promptId) throw new Error("Prompt ID is required");
			return await promptApi.getPrompt(promptId);
		},
		enabled: !!promptId,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const updatePromptMutation = useMutation<
		PromptResponse,
		Error,
		{ updateData: Partial<PromptSettings>; options?: Options },
		void
	>({
		mutationKey: promptKeys.update(promptId),
		retry: 3,
		retryDelay: (attempt) => Math.min(1000 * attempt, 5000),
		mutationFn: async ({ updateData }) => {
			if (!promptId) throw new Error("Prompt ID is required");
			return await promptApi.updatePrompt(promptId, updateData);
		},
		onSuccess: (result, variables) => {
			queryClient.setQueryData<PromptResponse>(queryKey, (oldData) => {
				if (!oldData) return result;
				return {
					...oldData,
					prompt: result.prompt || oldData.prompt,
				};
			});

			if (variables.updateData.name !== undefined) {
				queryClient.invalidateQueries({ queryKey: promptKeys.listRoot() });
				queryClient.invalidateQueries({ queryKey: promptKeys.promptNames() });
			}
		},
	});

	const updatePrompt = async (updateData: Partial<PromptSettings>, _options?: Options) => {
		if (!promptId) return;
		return await updatePromptMutation.mutateAsync({ updateData, options: _options });
	};

	const error = updatePromptMutation.error
		? getErrorMessage(updatePromptMutation.error, "Failed to update prompt")
		: promptQuery.error
			? getErrorMessage(promptQuery.error, "Failed to fetch prompt")
			: null;

	return {
		prompt: promptQuery.data ?? null,
		loading: promptQuery.isLoading,
		initialLoading: promptQuery.isLoading,
		isUpdating: updatePromptMutation.isPending,
		error,
		updatePrompt,
	};
}
