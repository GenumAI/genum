import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { organizationApi, type LanguageModel } from "@/api/organization";
import { useToast } from "@/hooks/useToast";
import { organizationKeys } from "@/query-keys/organization.keys";

type ToggleModelVariables = {
	modelId: number;
	enabled: boolean;
};

export function useOrgModels() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const modelsQueryKey = organizationKeys.models();
	const toggleMutationKey = [...modelsQueryKey, "toggle"] as const;

	const { data, isLoading, error } = useQuery({
		queryKey: modelsQueryKey,
		queryFn: () => organizationApi.getOrganizationModels(),
		refetchOnMount: false,
	});

	const pendingModelIds = useMutationState<number | undefined>({
		filters: {
			mutationKey: toggleMutationKey,
			status: "pending",
		},
		select: (mutation) => (mutation.state.variables as ToggleModelVariables | undefined)?.modelId,
	}).filter((modelId): modelId is number => typeof modelId === "number");

	const toggleMutation = useMutation({
		mutationKey: toggleMutationKey,
		mutationFn: ({ modelId, enabled }: ToggleModelVariables) =>
			organizationApi.toggleOrganizationModel(modelId, enabled),
		onMutate: async ({ modelId, enabled }) => {
			await queryClient.cancelQueries({ queryKey: modelsQueryKey });

			const previousData = queryClient.getQueryData<{ models: LanguageModel[] }>(modelsQueryKey);

			queryClient.setQueryData<{ models: LanguageModel[] }>(modelsQueryKey, (current) => {
				if (!current) {
					return current;
				}

				return {
					...current,
					models: current.models.map((model) =>
						model.id === modelId ? { ...model, enabled } : model,
					),
				};
			});

			return { previousData, modelId };
		},
		onSuccess: (response, variables) => {
			queryClient.setQueryData<{ models: LanguageModel[] }>(modelsQueryKey, (current) => {
				if (!current) {
					return current;
				}

				return {
					...current,
					models: current.models.map((model) =>
						model.id === variables.modelId
							? { ...model, enabled: response.enabled }
							: model,
					),
				};
			});

			toast({
				title: "Success",
				description: variables.enabled
					? "Model enabled successfully"
					: "Model disabled successfully",
				duration: 3000,
			});
		},
		onError: (error: Error, _variables, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(modelsQueryKey, context.previousData);
			}

			toast({
				title: "Error",
				description: error.message || "Failed to update model status",
				variant: "destructive",
				duration: 3000,
			});
		},
	});

	const getUsageMutation = useMutation({
		mutationFn: (modelId: number) => organizationApi.getModelUsage(modelId),
	});

	return {
		models: data?.models || [],
		isLoading,
		error,
		toggleModel: toggleMutation.mutate,
		pendingModelIds,
		getUsage: getUsageMutation.mutateAsync,
		isLoadingUsage: getUsageMutation.isPending,
	};
}

export type { LanguageModel };
