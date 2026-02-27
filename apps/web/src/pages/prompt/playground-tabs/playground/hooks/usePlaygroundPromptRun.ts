import { useCallback, useEffect } from "react";
import { promptApi } from "@/api/prompt";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { formatTestcaseOutput } from "@/lib/formatTestcaseOutput";
import { useToast } from "@/hooks/useToast";
import type { PromptResponse } from "@/api/prompt";
import type { PromptSettings } from "@/types/Prompt";
import type { TestCase } from "@/types/TestСase";
import type { FileMetadata } from "@/api/files";
import { useQueryClient } from "@tanstack/react-query";
import { testcaseKeys } from "@/query-keys/testcases.keys";
import { usePromptActions } from "@/stores/prompt.store";

export function usePlaygroundPromptRun({
	promptId,
	testcaseId,
	testcase,
	inputContent,
	selectedMemoryId,
	storeOutputContent,
	wasRun,
	currentAssertionType,
	promptSettings,
	selectedFiles,
	setRunState,
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
	selectedFiles: FileMetadata[];
	setRunState: (state: { loading: boolean; wasRun?: boolean }) => void;
	setOutputContent: (value: PromptResponse | null) => void;
	setStatus: (status: string) => void;
	openAssertionModal: () => void;
}) {
	const { toast } = useToast();
	const { setRunLoading, setRunError, setLastRunResult } = usePromptActions();
	const queryClient = useQueryClient();

	const handleRun = useCallback(async () => {
		if (!promptId) return;

		setRunState({ loading: true });
		setRunLoading(true);
		setRunError(null);

		try {
			const runParams = {
				question: inputContent,
				...(selectedMemoryId && { memoryId: Number(selectedMemoryId) }),
				...(selectedFiles.length > 0 && { files: selectedFiles.map((f) => f.id) }),
			};

			if (!testcaseId) {
				const result = await promptApi.runPrompt(promptId, runParams);
				if (result) {
					setLastRunResult(result);
					setOutputContent(result);
				}
				return;
			}

			const testcaseResponse = await testcasesApi.runTestcase(testcaseId, runParams);
			const result = formatTestcaseOutput(testcaseResponse);

			if (result) {
				setLastRunResult(result);
				setOutputContent(result);
				setRunState({ loading: false, wasRun: true });

				if (promptId) {
					queryClient.invalidateQueries({
						queryKey: testcaseKeys.promptTestcases(promptId),
					});
					queryClient.invalidateQueries({
						queryKey: testcaseKeys.statusCounts(promptId),
					});
				}
				window.dispatchEvent(new CustomEvent("testcaseUpdated"));
				return;
			}
		} catch (err: unknown) {
			const error =
				err instanceof Error ? err : new Error("Failed to run prompt/testcase");
			console.error("Failed to run prompt/testcase:", err);
			setRunError(error.message);
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
				duration: 6000,
			});
			if (testcaseId && promptId) {
				queryClient.invalidateQueries({
					queryKey: testcaseKeys.promptTestcases(promptId),
				});
				queryClient.invalidateQueries({ queryKey: testcaseKeys.statusCounts(promptId) });
			}
		} finally {
			setRunState({ loading: false });
			setRunLoading(false);
		}
	}, [
		inputContent,
		promptId,
		selectedMemoryId,
		selectedFiles,
		setRunState,
		setOutputContent,
		testcaseId,
		queryClient,
		setRunLoading,
		setRunError,
		setLastRunResult,
		toast,
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
