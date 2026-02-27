import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt";
import { helpersApi } from "@/api/helpers/helpers.api";
import type { AuditData } from "@/types/audit";
import { helperKeys } from "@/query-keys/helpers.keys";
import { useAuditActions, useAuditUI } from "@/stores/audit.store";

interface UseAuditOptions {
	onAuditSuccess?: (data: AuditData) => void;
	onAuditError?: (error: Error) => void;
	onFixSuccess?: (fixedPrompt: string) => void;
	onFixError?: (error: Error) => void;
	playgroundFlow?: {
		promptValue?: string;
		setIsPromptChangedAfterAudit: (changed: boolean) => void;
		updatePromptContent: (
			value: string,
			options?: { isWithoutUpdate: boolean; isFormattingOnly: boolean },
		) => Promise<void>;
	};
}

export function useAudit(promptId: string | number | undefined, options?: UseAuditOptions) {
	const queryClient = useQueryClient();
	const auditDataKey = helperKeys.auditData(promptId);
	const {
		isAuditLoading,
		isFixing,
		showAuditModal,
		diffModalInfo,
	} = useAuditUI();
	const {
		openAuditModal,
		closeAuditModal,
		setDiffModal,
		setFixingState,
		setAuditLoading,
	} = useAuditActions();
	const playgroundFlow = options?.playgroundFlow;
	const promptValue = playgroundFlow?.promptValue;
	const onAuditSuccess = options?.onAuditSuccess;
	const onAuditError = options?.onAuditError;
	const onFixSuccess = options?.onFixSuccess;
	const onFixError = options?.onFixError;

	const { data: currentAuditData = null } = useQuery<AuditData | null>({
		queryKey: auditDataKey,
		queryFn: async () => {
			if (!promptId) return null;
			const response = await promptApi.getPrompt(promptId);
			return (response.prompt?.audit?.data ?? null) as AuditData | null;
		},
		enabled: !!promptId,
		staleTime: Infinity,
		gcTime: Infinity,
	});

	const runAuditMutation = useMutation({
		mutationFn: async (targetPromptId: string | number) => {
			return promptApi.auditPrompt(targetPromptId);
		},
		onMutate: () => {
			setAuditLoading(true);
		},
		onSuccess: async (data, targetPromptId) => {
			await queryClient.invalidateQueries({
				queryKey: helperKeys.auditData(targetPromptId),
			});

			if (playgroundFlow && data?.audit) {
				playgroundFlow.setIsPromptChangedAfterAudit(false);
				openAuditModal();
			}

			if (data?.audit) {
				onAuditSuccess?.(data.audit as AuditData);
			}
		},
		onError: (err) => {
			const error = err instanceof Error ? err : new Error("Audit failed");
			console.error("Audit failed:", err);
			onAuditError?.(error);
		},
		onSettled: () => {
			setAuditLoading(false);
		},
	});

	const runAudit = useCallback(
		async (nextPromptId?: string | number) => {
			const targetPromptId = nextPromptId ?? promptId;
			if (!targetPromptId) return null;
			const data = await runAuditMutation.mutateAsync(targetPromptId);
			return (data?.audit ?? null) as AuditData | null;
		},
		[promptId, runAuditMutation],
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
					if (playgroundFlow) {
						setDiffModal({ prompt: response.prompt });
						closeAuditModal();
					}
					onFixSuccess?.(response.prompt);
					return response.prompt;
				}

				return null;
			} catch (err) {
				const error = err instanceof Error ? err : new Error("Error tuning prompt");
				console.error("Error tuning prompt:", err);
				onFixError?.(error);
				return null;
			}
		},
		[closeAuditModal, onFixError, onFixSuccess, playgroundFlow, setDiffModal],
	);

	const clearAuditData = useCallback(() => {
		if (!promptId) return;
		queryClient.removeQueries({
			queryKey: auditDataKey,
			exact: true,
		});
	}, [auditDataKey, promptId, queryClient]);

	const handleOpenAuditModal = useCallback(() => {
		openAuditModal();
	}, [openAuditModal]);

	const handleCloseAuditModal = useCallback(() => {
		closeAuditModal();
	}, [closeAuditModal]);

	const handleFixRisks = useCallback(
		async (recommendations: string[]) => {
			if (!promptValue) return;
			setFixingState(true);
			try {
				await fixRisks(promptValue, recommendations);
			} finally {
				setFixingState(false);
			}
		},
		[fixRisks, promptValue, setFixingState],
	);

	const handleDiffSave = useCallback(
		(value: string) => {
			if (value && playgroundFlow) {
				playgroundFlow.updatePromptContent(value, {
					isWithoutUpdate: false,
					isFormattingOnly: false,
				});
				clearAuditData();
				playgroundFlow.setIsPromptChangedAfterAudit(true);
			}
			setDiffModal(null);
		},
		[clearAuditData, playgroundFlow, setDiffModal],
	);

	return {
		// State
		currentAuditData,
		isAuditLoading,
		isFixing,
		showAuditModal,
		diffModalInfo,

		// Actions
		runAudit,
		fixRisks,
		clearAuditData,
		setDiffModal,
		handleOpenAuditModal,
		handleCloseAuditModal,
		handleFixRisks,
		handleDiffSave,
		canRunAudit: !!promptId && !!promptValue && !isAuditLoading,
	};
}
