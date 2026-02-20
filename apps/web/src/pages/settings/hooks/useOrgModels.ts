import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { organizationApi, type LanguageModel } from "@/api/organization";
import { useToast } from "@/hooks/useToast";
import { organizationKeys } from "@/query-keys/organization.keys";

export function useOrgModels() {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const { data, isLoading, error } = useQuery({
		queryKey: organizationKeys.models(),
		queryFn: () => organizationApi.getOrganizationModels(),
	});

	const toggleMutation = useMutation({
		mutationFn: ({ modelId, enabled }: { modelId: number; enabled: boolean }) =>
			organizationApi.toggleOrganizationModel(modelId, enabled),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: organizationKeys.models() });
			toast({
				title: "Success",
				description: variables.enabled
					? "Model enabled successfully"
					: "Model disabled successfully",
				duration: 3000,
			});
		},
		onError: (error: Error) => {
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
		isToggling: toggleMutation.isPending,
		getUsage: getUsageMutation.mutateAsync,
		isLoadingUsage: getUsageMutation.isPending,
	};
}

export type { LanguageModel };
