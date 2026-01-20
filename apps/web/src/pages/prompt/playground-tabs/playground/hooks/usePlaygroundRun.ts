import { useCallback, useEffect } from "react";
import { useRunPrompt } from "@/hooks/useRunPrompt";
import { promptApi } from "@/api/prompt";
import type { PromptResponse } from "@/hooks/useRunPrompt";
import type { PromptSettings } from "@/types/Prompt";
import type { TestCase } from "@/types/TestСase";
import { useQueryClient } from "@tanstack/react-query";

export function usePlaygroundRunController({
	promptId,
	testcaseId,
	testcase,
	inputContent,
	selectedMemoryId,
	storeOutputContent,
	wasRun,
	currentAssertionType,
	promptSettings,
	setRunState,
	setClearedOutput,
	setOutputContent,
	setStatus,
	openAssertionModal,
}: {
	promptId: number | undefined;
	testcaseId: string | null;
	testcase: TestCase | null;
	inputContent: string;
	selectedMemoryId: string;
	storeOutputContent: PromptResponse | null;
	wasRun: boolean;
	currentAssertionType: string;
	promptSettings: PromptSettings | undefined;
	setRunState: (state: { loading: boolean; wasRun?: boolean }) => void;
	setClearedOutput: (output: PromptResponse | null) => void;
	setOutputContent: (value: PromptResponse | null) => void;
	setStatus: (status: string) => void;
	openAssertionModal: () => void;
}) {
	const { runPrompt } = useRunPrompt();
	const queryClient = useQueryClient();

	const handleRun = useCallback(async () => {
		if (!promptId) return;

		setClearedOutput(null);
		setRunState({ loading: true });

		try {
			const runParams = {
				question: inputContent,
				...(selectedMemoryId && { memoryId: Number(selectedMemoryId) }),
			};

			if (!testcaseId) {
				const result = await runPrompt(promptId, runParams);
				if (result) {
					setOutputContent(result);
				}
				return;
			}

			const result = await runPrompt(promptId, runParams, testcaseId);

			if (result) {
				setOutputContent(result);
				setRunState({ loading: false, wasRun: true });

				if (promptId) {
					queryClient.invalidateQueries({ queryKey: ["prompt-testcases", promptId] });
					queryClient.invalidateQueries({
						queryKey: ["testcase-status-counts", promptId],
					});
				}
				window.dispatchEvent(new CustomEvent("testcaseUpdated"));
				return;
			}
		} catch (error) {
			console.error("Failed to run prompt/testcase:", error);
			if (testcaseId && promptId) {
				queryClient.invalidateQueries({ queryKey: ["prompt-testcases", promptId] });
				queryClient.invalidateQueries({ queryKey: ["testcase-status-counts", promptId] });
			}
		} finally {
			setRunState({ loading: false });
		}
	}, [
		inputContent,
		promptId,
		runPrompt,
		selectedMemoryId,
		setClearedOutput,
		setRunState,
		setOutputContent,
		testcaseId,
		queryClient,
	]);

	// After a testcase run: open assertion modal + refresh latest status counts
	useEffect(() => {
		if (!storeOutputContent || !testcaseId || !testcase || !wasRun) {
			return;
		}

		setStatus(storeOutputContent.status);
		const assertionType = currentAssertionType || promptSettings?.assertionType;
		if (assertionType === "AI" || assertionType === "STRICT") {
			openAssertionModal();
		}

		const fetchLatestPromptData = async () => {
			try {
				if (!promptId) return;
				const data = await promptApi.getPrompt(promptId);
				if (data.prompt?.testcaseStatuses) {
					window.dispatchEvent(
						new CustomEvent("testcaseStatusUpdated", {
							detail: {
								promptId,
								testcaseStatuses: data.prompt.testcaseStatuses,
							},
						}),
					);
				}
			} catch (error) {
				console.error("Failed to fetch latest prompt data:", error);
			}
		};

		setTimeout(fetchLatestPromptData, 500);
		setRunState({ loading: false, wasRun: false });
	}, [
		storeOutputContent,
		testcaseId,
		testcase,
		wasRun,
		promptId,
		currentAssertionType,
		promptSettings?.assertionType,
		setStatus,
		openAssertionModal,
		setRunState,
	]);

	return { handleRun };
}
