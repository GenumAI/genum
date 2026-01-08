import { useEffect } from "react";
import usePlaygroundStore, {
	defaultPromptResponse,
	usePlaygroundActions,
	usePlaygroundAudit,
	usePlaygroundContent,
	usePlaygroundTestcase,
	usePlaygroundUI,
} from "@/stores/playground.store";
import { usePlaygroundModels } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundModels";
import { usePlaygroundPrompt } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundPrompt";
import { usePlaygroundTestcaseController } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundTestcase";
import { usePlaygroundRunController } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundRun";
import { usePlaygroundAuditController } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundAudit";
import type { PlaygroundControllerReturn } from "@/pages/prompt/playground-tabs/playground/hooks/types";

export function usePlaygroundController({
	promptId,
	orgId,
	projectId,
	testcaseId,
}: {
	promptId: number | undefined;
	orgId: string | undefined;
	projectId: string | undefined;
	testcaseId: string | null;
}) {
	const {
		setOutputContent,
		setExpectedOutput,
		setCurrentExpectedThoughts,
		resetForNewTestcase,
		clearAllState,
		fetchTestcases,
		setInputContent,
		setTestcaseLoadState,
		setRunState,
		setClearedOutput,
		setStatus,
		openAssertionModal,
		closeAssertionModal,
		setIsPromptChangedAfterAudit,
		openAuditModal,
		closeAuditModal,
		setDiffModal,
		setFixingState,
	} = usePlaygroundActions();
	const {
		inputContent,
		outputContent: storeOutputContent,
		clearedOutput,
		currentExpectedThoughts,
		originalPromptContent,
		livePromptValue,
		hasPromptContent,
		hasInputContent,
	} = usePlaygroundContent();
	const { currentAssertionType, testcases, selectedMemoryId } = usePlaygroundTestcase();
	const {
		modalOpen,
		status,
		wasRun,
		isStatusCountsLoading,
		runLoading,
		isFixing,
		isUpdatingPromptContent,
		showAuditModal,
		diffModalInfo,
		isTestcaseLoaded,
	} = usePlaygroundUI();
	const { isPromptChangedAfterAudit } = usePlaygroundAudit();

	const { models } = usePlaygroundModels();
	const { prompt, promptLoading, updatePromptError, updatePromptContent, handlePromptUpdate } =
		usePlaygroundPrompt({ promptId, orgId, projectId });

	// Local refs for cross-event consistency
	const get = usePlaygroundStore.getState;

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			clearAllState();
			setClearedOutput(null);
		};
	}, [clearAllState, setClearedOutput]);
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
		currentExpectedThoughts,
		inputContent,
		getStoreSnapshot: get,
		setInputContent,
		setExpectedOutput,
		setOutputContent,
		setCurrentExpectedThoughts,
		setTestcaseLoadState,
		resetForNewTestcase,
		fetchTestcases,
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
		setRunState,
		setClearedOutput,
		setOutputContent,
		setStatus,
		openAssertionModal,
		fetchTestcases,
	});

	const {
		currentAuditData,
		isAuditLoading,
		auditPrompt,
		handleOpenAuditModal,
		handleCloseAuditModal,
		handleRunAudit,
		handleFixRisks,
		handleDiffSave,
	} = usePlaygroundAuditController({
		promptId,
		promptValue: prompt?.prompt?.value,
		setIsPromptChangedAfterAudit,
		openAuditModal,
		closeAuditModal,
		setDiffModal,
		setFixingState,
		updatePromptContent,
	});

	const currentOutput = clearedOutput || storeOutputContent;

	const currentTokens = currentOutput?.tokens || defaultPromptResponse.tokens;
	const currentCost = currentOutput?.cost || defaultPromptResponse.cost;
	const currentResponseTime = currentOutput?.response_time_ms || null;

	const currentAuditRate = isPromptChangedAfterAudit
		? undefined
		: (currentAuditData?.rate ?? prompt?.prompt?.audit?.data?.rate);

	const systemPrompt = livePromptValue || originalPromptContent || prompt?.prompt?.value || "";

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
			loading: !!testcaseId && !isTestcaseLoaded && isStatusCountsLoading,
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
				statusCounts: isStatusCountsLoading,
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
