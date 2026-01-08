import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PromptResponse } from "@/hooks/useRunPrompt";
import { testcasesApi } from "@/api/testcases/testcases.api";
import type { UpdateExpected } from "@/pages/prompt/playground-tabs/playground-layout/outputs/Output";
import { defaultPromptResponse } from "@/stores/playground.store";
import { formatTestcaseOutput } from "@/lib/formatTestcaseOutput";
import type { TestCase } from "@/types/TestСase";

export function usePlaygroundTestcaseController({
	promptId,
	testcaseId,
	testcases,
	storeOutputContent,
	currentExpectedThoughts,
	inputContent,
	getStoreSnapshot,
	setInputContent,
	setExpectedOutput,
	setOutputContent,
	setCurrentExpectedThoughts,
	setTestcaseLoadState,
	resetForNewTestcase,
	fetchTestcases,
}: {
	promptId: number | undefined;
	testcaseId: string | null;
	testcases: TestCase[];
	storeOutputContent: PromptResponse | null;
	currentExpectedThoughts: string;
	inputContent: string;
	getStoreSnapshot: () => { outputContent: PromptResponse | null };
	setInputContent: (value: string) => void;
	setExpectedOutput: (value: PromptResponse | null) => void;
	setOutputContent: (value: PromptResponse | null) => void;
	setCurrentExpectedThoughts: (value: string) => void;
	setTestcaseLoadState: (state: { loaded: boolean; status?: string }) => void;
	resetForNewTestcase: () => void;
	fetchTestcases: (promptId: number | string) => Promise<void>;
}) {
	const prevTestcaseIdRef = useRef<string | null>(testcaseId);
	const lastSavedInputRef = useRef<string>("");
	const clearExpectedOutputRef = useRef<(() => void) | null>(null);

	const testcase = useMemo(() => {
		if (!testcaseId || !testcases.length) return null;
		return testcases.find((tc) => tc.id === Number(testcaseId)) || null;
	}, [testcases, testcaseId]);

	useEffect(() => {
		const prevTestcaseId = prevTestcaseIdRef.current;
		const currentTestcaseId = testcaseId;

		if (prevTestcaseId && (!currentTestcaseId || prevTestcaseId !== currentTestcaseId)) {
			resetForNewTestcase();
		}

		prevTestcaseIdRef.current = currentTestcaseId;
	}, [testcaseId, resetForNewTestcase]);

	// Load testcase data into store
	useEffect(() => {
		if (testcase) {
			const testcaseInput = testcase.input || "";
			setInputContent(testcaseInput);
			lastSavedInputRef.current = testcaseInput;

			setExpectedOutput(formatTestcaseOutput(testcase.expectedOutput));

			const formattedLastOutput = formatTestcaseOutput(testcase.lastOutput);
			if (
				formattedLastOutput &&
				formattedLastOutput.answer !== undefined &&
				formattedLastOutput.answer !== null
			) {
				const { outputContent } = getStoreSnapshot();

				const isSameAnswer = outputContent?.answer === formattedLastOutput.answer;
				const hasMetrics =
					(outputContent?.tokens?.total ?? 0) > 0 ||
					(outputContent?.response_time_ms ?? 0) > 0;

				if (!isSameAnswer || !hasMetrics) {
					setOutputContent(formattedLastOutput);
				}
			}

		setCurrentExpectedThoughts(testcase.expectedChainOfThoughts || "");
		setTestcaseLoadState({ loaded: true });
	} else if (!testcaseId) {
			setExpectedOutput(null);
		}
	}, [
		testcase,
		testcaseId,
		getStoreSnapshot,
		setInputContent,
		setExpectedOutput,
		setOutputContent,
		setCurrentExpectedThoughts,
		setTestcaseLoadState,
	]);

	const handleRegisterClearFunction = useCallback((clearFn: () => void) => {
		clearExpectedOutputRef.current = clearFn;
	}, []);

	const handleTestcaseAdded = useCallback(async () => {
		resetForNewTestcase();
		setInputContent("");
		clearExpectedOutputRef.current?.();
		window.dispatchEvent(new CustomEvent("testcaseUpdated"));
	}, [resetForNewTestcase, setInputContent]);

	const handleSaveAsExpected = useCallback(
		async (newExpectedContent: UpdateExpected) => {
			const expectedOutputData: PromptResponse = {
				answer: newExpectedContent.answer,
				tokens: storeOutputContent?.tokens || defaultPromptResponse.tokens,
				cost: storeOutputContent?.cost || defaultPromptResponse.cost,
				response_time_ms:
					storeOutputContent?.response_time_ms || defaultPromptResponse.response_time_ms,
				status: storeOutputContent?.status || defaultPromptResponse.status,
			};
			setExpectedOutput(expectedOutputData);

			if (!testcaseId) {
				return;
			}

			try {
				const updateData = {
					expectedOutput: newExpectedContent.answer,
					expectedChainOfThoughts: currentExpectedThoughts || "",
				};

				await testcasesApi.updateTestcase(testcaseId, updateData);
				if (promptId) await fetchTestcases(promptId);
			} catch (error) {
				console.error("Failed to save as expected:", error);
			}
		},
		[
			currentExpectedThoughts,
			fetchTestcases,
			promptId,
			setExpectedOutput,
			storeOutputContent,
			testcaseId,
		],
	);

	const handleInputBlur = useCallback(async () => {
		if (!testcaseId) return;

		if (inputContent !== lastSavedInputRef.current) {
			try {
				await testcasesApi.updateTestcase(testcaseId, { input: inputContent });
				lastSavedInputRef.current = inputContent;
				if (promptId) await fetchTestcases(promptId);
			} catch (error) {
				console.error("Failed to update testcase input:", error);
			}
		}
	}, [fetchTestcases, inputContent, promptId, testcaseId]);

	const expectedContent = formatTestcaseOutput(testcase?.expectedOutput);

	return {
		testcase,
		expectedContent,
		handleRegisterClearFunction,
		handleTestcaseAdded,
		handleSaveAsExpected,
		handleInputBlur,
	};
}


