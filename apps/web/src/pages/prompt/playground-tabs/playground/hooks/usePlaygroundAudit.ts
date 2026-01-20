import { useCallback } from "react";
import { useAudit } from "@/hooks/useAudit";
import type { UpdatePromptContentOptions } from "./types";

export function usePlaygroundAuditController({
	promptId,
	promptValue,
	setIsPromptChangedAfterAudit,
	openAuditModal,
	closeAuditModal,
	setDiffModal,
	setFixingState,
	updatePromptContent,
}: {
	promptId: number | undefined;
	promptValue: string | undefined;
	setIsPromptChangedAfterAudit: (changed: boolean) => void;
	openAuditModal: () => void;
	closeAuditModal: () => void;
	setDiffModal: (info: { prompt: string } | null) => void;
	setFixingState: (fixing: boolean) => void;
	updatePromptContent: (value: string, options?: UpdatePromptContentOptions) => Promise<void>;
}) {
	const { currentAuditData, runAudit, isAuditLoading, fixRisks, clearAuditData } = useAudit({
		onAuditSuccess: () => {
			setIsPromptChangedAfterAudit(false);
			openAuditModal();
		},
		onFixSuccess: (fixedPrompt) => {
			setDiffModal({ prompt: fixedPrompt });
			closeAuditModal();
		},
	});

	const auditPrompt = useCallback(async () => {
		if (!promptId || !promptValue || isAuditLoading) return;
		await runAudit(promptId);
	}, [promptId, promptValue, isAuditLoading, runAudit]);

	const handleOpenAuditModal = useCallback(() => {
		openAuditModal();
	}, [openAuditModal]);

	const handleCloseAuditModal = useCallback(() => {
		closeAuditModal();
	}, [closeAuditModal]);

	const handleRunAudit = useCallback(async () => {
		if (promptId) {
			await runAudit(promptId);
		}
	}, [promptId, runAudit]);

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
			if (value) {
				updatePromptContent(value, {
					isWithoutUpdate: false,
					isFormattingOnly: false,
				});
				clearAuditData();
				setIsPromptChangedAfterAudit(true);
			}
			setDiffModal(null);
		},
		[clearAuditData, setDiffModal, setIsPromptChangedAfterAudit, updatePromptContent],
	);

	return {
		currentAuditData,
		isAuditLoading,
		auditPrompt,
		handleOpenAuditModal,
		handleCloseAuditModal,
		handleRunAudit,
		handleFixRisks,
		handleDiffSave,
	};
}
