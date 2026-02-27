import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt";
import { helpersApi } from "@/api/helpers/helpers.api";
import type { AuditData } from "@/types/audit";
import { helperKeys } from "@/query-keys/helpers.keys";
import { usePlaygroundActions, usePlaygroundUI } from "@/stores/playground.store";

interface UseAuditOptions {
	onAuditSuccess?: (data: AuditData) => void;
	onAuditError?: (error: Error) => void;
	onFixSuccess?: (fixedPrompt: string) => void;
	onFixError?: (error: Error) => void;
}

export function useAudit(promptId: string | number | undefined, options?: UseAuditOptions) {
	const queryClient = useQueryClient();
	const auditDataKey = useMemo(() => helperKeys.auditData(promptId), [promptId]);
	const { isAuditLoading } = usePlaygroundUI();
	const { setAuditLoading } = usePlaygroundActions();

	const { data: currentAuditData = null } = useQuery<AuditData | null>({
		queryKey: auditDataKey,
		queryFn: () => null,
		enabled: false,
		staleTime: Infinity,
		gcTime: Infinity,
	});

	const setCurrentAuditData = useCallback(
		(value: AuditData | null) => {
			queryClient.setQueryData<AuditData | null>(auditDataKey, value);
		},
		[queryClient, auditDataKey],
	);

	const runAudit = useCallback(
		async (nextPromptId?: string | number) => {
			const targetPromptId = nextPromptId ?? promptId;
			if (!targetPromptId) return null;

			const targetAuditDataKey = helperKeys.auditData(targetPromptId);
			setAuditLoading(true);

			try {
				const data = await promptApi.auditPrompt(targetPromptId);

				if (data?.audit) {
					queryClient.setQueryData<AuditData | null>(targetAuditDataKey, data.audit);
					if (targetPromptId === promptId) {
						setCurrentAuditData(data.audit);
					}
					options?.onAuditSuccess?.(data.audit);
					return data.audit;
				}

				return null;
			} catch (err) {
				const error = err instanceof Error ? err : new Error("Audit failed");
				console.error("Audit failed:", err);
				options?.onAuditError?.(error);
				return null;
			} finally {
				setAuditLoading(false);
			}
		},
		[options, promptId, queryClient, setCurrentAuditData, setAuditLoading],
	);

	const fixRisks = useCallback(
		async (promptValue: string, recommendations: string[]) => {
			if (recommendations.length === 0) {
				return null;
			}

			const context = recommendations.join("\\n\\n---\\n\\n");

			try {
				const response = await helpersApi.promptTune({
					context,
					instruction: promptValue,
				});

				if (response?.prompt) {
					options?.onFixSuccess?.(response.prompt);
					return response.prompt;
				}

				return null;
			} catch (err) {
				const error = err instanceof Error ? err : new Error("Error tuning prompt");
				console.error("Error tuning prompt:", err);
				options?.onFixError?.(error);
				return null;
			}
		},
		[options],
	);

	const clearAuditData = useCallback(() => {
		setCurrentAuditData(null);
	}, [setCurrentAuditData]);

	return {
		// State
		currentAuditData,
		isAuditLoading,

		// Actions
		runAudit,
		fixRisks,
		clearAuditData,
		setCurrentAuditData,
	};
}
