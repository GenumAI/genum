import { useCallback, useEffect, useRef, useState } from "react";
import { defaultPromptResponse } from "@/lib/defaultPromptResponse";
import { usePlaygroundActions, usePlaygroundUI } from "@/stores/playground.store";
import { useAudit } from "@/hooks/useAudit";
import { usePlaygroundModels } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundModels";
import { usePlaygroundPrompt } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundPrompt";
import { usePlaygroundTestcaseController } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundTestcase";
import { usePlaygroundRunController } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundRun";
import { usePlaygroundInput } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundInput";
import { usePlaygroundOutput } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundOutput";
import { usePlaygroundAssertion } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundAssertion";
import { usePlaygroundSession } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundSession";
import type { PlaygroundControllerReturn } from "@/pages/prompt/playground-tabs/playground/hooks/types";
import { usePromptTestcases } from "@/hooks/usePromptTestcases";
import { useMemorySelection } from "@/pages/prompt/playground-tabs/memory/hooks/useMemorySelection";

import type { FileMetadata } from "@/api/files";

export function usePlaygroundController({
	promptId,
	orgId,
	projectId,
	testcaseId,
	selectedFiles = [],
}: {
	promptId: number | undefined;
	orgId: string | undefined;
	projectId: string | undefined;
	testcaseId: string | null;
	selectedFiles?: FileMetadata[];
}) {
	const {
		openAssertionModal,
		closeAssertionModal,
		resetForPromptExit,
	} = usePlaygroundActions();
	const { inputContent, setInputContent, clearInputContent, hasInputContent } = usePlaygroundInput({
		promptId,
		testcaseId,
	});
	const {
		outputContent: storeOutputContent,
		expectedOutput: currentExpectedOutput,
		currentExpectedThoughts,
		setOutputContent,
		setExpectedOutput,
		setCurrentExpectedThoughts,
		resetOutputState,
	} = usePlaygroundOutput({
		promptId,
		testcaseId,
	});
	const { selection } = useMemorySelection(promptId, testcaseId);
	const selectedMemoryId = selection.selectedMemoryId;
	const { modalOpen } = usePlaygroundUI();
	const [isPromptChangedAfterAudit, setIsPromptChangedAfterAudit] = useState(false);
	const {
		status,
		wasRun,
		runLoading,
		isTestcaseLoaded,
		setRunState,
		setStatus,
		setTestcaseLoadState,
	} = usePlaygroundSession({
		promptId,
		testcaseId,
	});

	const { data: testcases = [], isLoading: isTestcasesLoading } = usePromptTestcases(promptId);

	const { models } = usePlaygroundModels();
	const {
		prompt,
		promptLoading,
		updatePromptError,
		updatePromptContent,
		handlePromptUpdate,
		originalPromptContent,
		livePromptValue,
		hasPromptContent,
		isUpdatingPromptContent,
		setLivePromptValue,
	} = usePlaygroundPrompt({ promptId, orgId, projectId });
	const { currentAssertionType } = usePlaygroundAssertion({
		promptId,
		serverAssertionType: prompt?.prompt?.assertionType,
		serverAssertionValue: prompt?.prompt?.assertionValue,
	});
	const cleanupRef = useRef({
		cleanupScope: () => {},
	});
	const resetPlaygroundState = useCallback(() => {
		clearInputContent();
		resetOutputState();
		setRunState({ loading: false, wasRun: false });
		setTestcaseLoadState({ loaded: false });
		setStatus("");
	}, [clearInputContent, resetOutputState, setRunState, setTestcaseLoadState, setStatus]);

	// Cleanup on unmount
	useEffect(() => {
		cleanupRef.current = {
			cleanupScope: () => {
				resetForPromptExit(promptId, testcaseId);
			},
		};
	}, [promptId, testcaseId, resetForPromptExit]);

	useEffect(() => {
		return () => {
			cleanupRef.current.cleanupScope();
		};
	}, []);

	const {
		testcase,
		expectedContent,
		handleRegisterClearFunction,
		handleTestcaseAdded,
		handleSaveAsExpected,
		handleInputBlur,
	} = usePlaygroundTestcaseController({
		promptId,
		testcaseId,
		testcases,
		storeOutputContent,
		currentExpectedOutput,
		currentExpectedThoughts,
		inputContent,
		setInputContent,
		setExpectedOutput,
		setOutputContent,
		setCurrentExpectedThoughts,
		setTestcaseLoadState,
		resetPlaygroundState,
	});

	const { handleRun } = usePlaygroundRunController({
		promptId,
		testcaseId,
		testcase,
		inputContent,
		selectedMemoryId,
		storeOutputContent,
		wasRun,
		currentAssertionType,
		promptSettings: prompt?.prompt,
		selectedFiles,
		setRunState,
		setOutputContent,
		setStatus,
		openAssertionModal,
	});

	const {
		currentAuditData,
		isAuditLoading,
		isFixing,
		showAuditModal,
		diffModalInfo,
		setDiffModal,
		runAudit,
		canRunAudit,
		handleOpenAuditModal,
		handleCloseAuditModal,
		handleFixRisks,
		handleDiffSave,
	} = useAudit(promptId, {
		playgroundFlow: {
			promptValue: prompt?.prompt?.value,
			setIsPromptChangedAfterAudit,
			updatePromptContent,
		},
	});
	const handleRunAudit = useCallback(async () => {
		if (!promptId) return;
		await runAudit(promptId);
	}, [promptId, runAudit]);

	const auditPrompt = useCallback(async () => {
		if (!canRunAudit || !promptId) return;
		await runAudit(promptId);
	}, [canRunAudit, promptId, runAudit]);

	const currentOutput = storeOutputContent;

	const currentTokens = currentOutput?.tokens || defaultPromptResponse.tokens;
	const currentCost = currentOutput?.cost || defaultPromptResponse.cost;
	const currentResponseTime = currentOutput?.response_time_ms || null;

	const currentAuditRate = isPromptChangedAfterAudit
		? undefined
		: (currentAuditData?.rate ?? prompt?.prompt?.audit?.data?.rate);

	const systemPrompt = livePromptValue;

	return {
		prompt: {
			data: prompt,
			loading: promptLoading,
			error: updatePromptError,
			content: systemPrompt,
			originalContent: originalPromptContent,
		},
		testcase: {
			data: testcase,
			id: testcaseId,
			expectedContent,
			loading: !!testcaseId && !isTestcaseLoaded && isTestcasesLoading,
		},
		metrics: {
			tokens: currentTokens,
			cost: currentCost,
			responseTime: currentResponseTime,
		},
		ui: {
			modals: {
				assertion: { open: modalOpen, status },
				audit: {
					open: showAuditModal,
					data: currentAuditData,
					rate: currentAuditRate,
				},
				diff: diffModalInfo,
			},
			loading: {
				prompt: promptLoading,
				run: runLoading,
				audit: isAuditLoading,
				fixing: isFixing,
				statusCounts: isTestcasesLoading,
				updatingContent: isUpdatingPromptContent,
			},
			validation: {
				hasPromptContent,
				hasInputContent,
			},
		},
		models,
		actions: {
			prompt: {
				update: updatePromptContent,
				handleUpdate: handlePromptUpdate,
				setLiveValue: setLivePromptValue,
			},
			testcase: {
				saveAsExpected: handleSaveAsExpected,
				onAdded: handleTestcaseAdded,
				onInputBlur: handleInputBlur,
				registerClearFn: handleRegisterClearFunction,
			},
			run: handleRun,
			audit: {
				run: auditPrompt,
				openModal: handleOpenAuditModal,
				closeModal: handleCloseAuditModal,
				runAudit: handleRunAudit,
				fix: handleFixRisks,
				saveDiff: handleDiffSave,
			},
			ui: {
				closeAssertionModal,
				setDiffModal,
			},
		},
	} satisfies PlaygroundControllerReturn;
}
