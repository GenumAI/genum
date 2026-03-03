import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt";
import { toast } from "@/hooks/useToast";
import { versionKeys } from "@/query-keys/version.keys";
import { promptKeys } from "@/query-keys/prompt.keys";

interface RollbackParams {
	promptId: string;
	versionId: string;
}

export const useRollbackVersion = () => {
	const queryClient = useQueryClient();
	const rollbackMutation = useMutation({
		mutationFn: async ({ promptId, versionId }: RollbackParams) =>
			promptApi.rollbackVersion(promptId, versionId),
		onSuccess: async (_, { promptId }) => {
			await queryClient.invalidateQueries({ queryKey: versionKeys.versions(promptId) });
			await queryClient.invalidateQueries({ queryKey: promptKeys.byId(promptId) });
		},
	});

	const rollback = useCallback(
		async ({ promptId, versionId }: RollbackParams) => {
			try {
				await rollbackMutation.mutateAsync({ promptId, versionId });
				return true;
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : "Something went wrong";
				toast({
					title: "Rollback failed",
					description: errorMessage,
					variant: "destructive",
				});
				return false;
			}
		},
		[rollbackMutation],
	);

	return {
		rollback,
		isPending: rollbackMutation.isPending,
	};
};
