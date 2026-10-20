import { useCallback } from "react";
import { useQuery, useMutation, type QueryClient } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt";
import { promptKeys } from "@/query-keys/prompt.keys";
import { modelsSettingsKeys } from "@/query-keys/models-settings.keys";
import type { PromptSettings } from "@/types/Prompt";
import type { ResponseModelConfig } from "@/types/AIModel";

interface UseModelSettingsApiProps {
	promptId?: number;
	modelConfigTargetId: number | null;
	isUpdatingModel: boolean;
	queryClient: QueryClient;
	setIsCommitted: (isCommitted: boolean) => void;
}

type PromptResponse = {
	prompt: PromptSettings;
};

/**
 * Server state of the models settings: the active model's config query, the two prompt mutations
 * and the imperative fetches around them.
 */
export function useModelSettingsApi({
	promptId,
	modelConfigTargetId,
	isUpdatingModel,
	queryClient,
	setIsCommitted,
}: UseModelSettingsApiProps) {
	const modelConfigQuery = useQuery({
		queryKey: modelsSettingsKeys.modelConfig(modelConfigTargetId),
		queryFn: async (): Promise<ResponseModelConfig | null> => {
			if (!modelConfigTargetId) return null;
			const data = await promptApi.getModelConfig(modelConfigTargetId);
			return data.config;
		},
		enabled: !!modelConfigTargetId && !isUpdatingModel,
		refetchOnWindowFocus: false,
		placeholderData: (previousData) => previousData,
	});

	const updatePromptModelMutation = useMutation({
		mutationKey: modelsSettingsKeys.updatePromptModel(promptId),
		mutationFn: async ({
			targetPromptId,
			modelId,
		}: {
			targetPromptId: number;
			modelId: number;
		}) => promptApi.updatePromptModel(targetPromptId, modelId),
		onSuccess: (result) => {
			if (promptId) {
				queryClient.setQueryData(promptKeys.byId(promptId), result);
			}
		},
	});

	const updateModelSettingsMutation = useMutation({
		mutationKey: modelsSettingsKeys.updatePromptConfig(promptId),
		mutationFn: async ({
			targetPromptId,
			payload,
		}: {
			targetPromptId: number;
			payload: Record<string, unknown>;
		}) => promptApi.updateModelConfig(targetPromptId, payload),
		onSuccess: (result) => {
			if (promptId) {
				queryClient.setQueryData(promptKeys.byId(promptId), result);
			}
		},
	});

	const getModelConfig = useCallback(
		async (modelId: number): Promise<ResponseModelConfig | null> => {
			if (!modelId) return null;
			return queryClient.fetchQuery({
				queryKey: modelsSettingsKeys.modelConfig(modelId),
				queryFn: async () => {
					const response = await promptApi.getModelConfig(modelId);
					return response.config;
				},
			});
		},
		[queryClient],
	);

	const updatePromptModel = useCallback(
		async (targetPromptId: number, modelId: number): Promise<boolean> => {
			if (!targetPromptId || !modelId) return false;
			await updatePromptModelMutation.mutateAsync({ targetPromptId, modelId });
			return true;
		},
		[updatePromptModelMutation],
	);

	const updateModelSettings = useCallback(
		async (targetPromptId: number, payload: Record<string, unknown>): Promise<boolean> => {
			if (!targetPromptId) return false;
			await updateModelSettingsMutation.mutateAsync({ targetPromptId, payload });
			return true;
		},
		[updateModelSettingsMutation],
	);

	const getCommitStatus = useCallback(async () => {
		if (!promptId) return null;
		try {
			const result = await queryClient.fetchQuery<PromptResponse>({
				queryKey: promptKeys.byId(promptId),
				queryFn: () => promptApi.getPrompt(promptId),
			});
			if (result.prompt) {
				const commited = result.prompt.commited || false;
				setIsCommitted(commited);
				return result.prompt;
			}
		} catch (error) {
			console.error("❌ Failed to get commit status:", error);
		}
		return null;
	}, [promptId, queryClient, setIsCommitted]);

	// Only `data` is read: the query result tracks property access, so reading more of it here
	// would subscribe the component to more re-renders.
	const activeModelConfig = modelConfigQuery.data;
	const loading = updatePromptModelMutation.isPending || updateModelSettingsMutation.isPending;

	return {
		activeModelConfig,
		loading,
		getModelConfig,
		updatePromptModel,
		updateModelSettings,
		getCommitStatus,
	};
}
