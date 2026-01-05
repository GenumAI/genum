import { useCallback } from "react";
import { promptApi } from "@/api/prompt";
import { helpersApi } from "@/api/helpers/helpers.api";
import { usePlaygroundAudit, usePlaygroundActions } from "@/stores/playground.store";
import type { AuditData } from "@/types/audit";

interface UseAuditOptions {
	onAuditSuccess?: (data: AuditData) => void;
	onAuditError?: (error: Error) => void;
	onFixSuccess?: (fixedPrompt: string) => void;
	onFixError?: (error: Error) => void;
}

export function useAudit(options?: UseAuditOptions) {
	const { currentAuditData, isAuditLoading } = usePlaygroundAudit();
	const { setCurrentAuditData, setFlags } = usePlaygroundActions();

	const runAudit = useCallback(
		async (promptId: string | number) => {
			setFlags({ isAuditLoading: true });

			try {
				const data = await promptApi.auditPrompt(promptId);

				if (data?.audit) {
					setCurrentAuditData(data.audit);
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
				setFlags({ isAuditLoading: false });
			}
		},
		[options, setCurrentAuditData, setFlags],
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
