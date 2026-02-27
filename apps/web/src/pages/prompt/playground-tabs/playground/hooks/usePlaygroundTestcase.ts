import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PromptResponse } from "@/hooks/useRunPrompt";
import { testcasesApi } from "@/api/testcases/testcases.api";
import type { UpdateExpected } from "@/pages/prompt/playground-tabs/playground/components/outputs/Output";
import { formatTestcaseOutput } from "@/lib/formatTestcaseOutput";
import type { TestCase } from "@/types/TestСase";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { testcaseKeys } from "@/query-keys/testcases.keys";
import usePlaygroundStore from "@/stores/playground.store";

const emptyPromptResponse: PromptResponse = {
	answer: "",
	tokens: {
		prompt: 0,
		completion: 0,
		total: 0,
	},
	cost: {
		prompt: 0,
		completion: 0,
		total: 0,
	},
	response_time_ms: 0,
	status: "",
};

const hasVisibleMetrics = (value?: PromptResponse | null) =>
	(value?.tokens?.total ?? 0) > 0 ||
	(value?.cost?.total ?? 0) > 0 ||
	(value?.response_time_ms ?? 0) > 0;

const isSameOutputSnapshot = (
	first?: PromptResponse | null,
	second?: PromptResponse | null,
) => {
	return (
		(first?.answer ?? "") === (second?.answer ?? "") &&
		(first?.tokens?.total ?? 0) === (second?.tokens?.total ?? 0) &&
		(first?.cost?.total ?? 0) === (second?.cost?.total ?? 0) &&
		(first?.response_time_ms ?? 0) === (second?.response_time_ms ?? 0) &&
		(first?.status ?? "") === (second?.status ?? "")
	);
};

export function usePlaygroundTestcaseController({
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
}: {
	promptId: number | undefined;
	testcaseId: string | null;
	testcases: TestCase[];
	storeOutputContent: PromptResponse | null;
	currentExpectedOutput: PromptResponse | null;
	currentExpectedThoughts: string;
	inputContent: string;
	setInputContent: (value: string) => void;
	setExpectedOutput: (value: PromptResponse | null) => void;
	setOutputContent: (value: PromptResponse | null) => void;
	setCurrentExpectedThoughts: (value: string) => void;
	setTestcaseLoadState: (state: { loaded: boolean; status?: string }) => void;
	resetPlaygroundState: () => void;
}) {
	const prevTestcaseIdRef = useRef<string | null>(testcaseId);
	const lastSavedInputRef = useRef<string>("");
	const clearExpectedOutputRef = useRef<(() => void) | null>(null);
	const queryClient = useQueryClient();
	const updateTestcaseInputMutation = useMutation({
		mutationKey: testcaseKeys.updateInput(testcaseId ?? undefined),
		mutationFn: async (value: string) => {
			if (!testcaseId) return;
			await testcasesApi.updateTestcase(testcaseId, { input: value });
		},
		onSuccess: async (_data, value) => {
			lastSavedInputRef.current = value;
			if (!testcaseId) return;
			await queryClient.invalidateQueries({
				queryKey: testcaseKeys.byId(testcaseId),
			});
			await queryClient.invalidateQueries({
				queryKey: testcaseKeys.byIdAlt(testcaseId),
			});
			if (promptId) {
				await queryClient.invalidateQueries({
					queryKey: testcaseKeys.promptTestcases(promptId),
				});
				await queryClient.invalidateQueries({
					queryKey: testcaseKeys.statusCounts(promptId),
				});
			}
		},
	});

	const testcase = useMemo(() => {
		if (!testcaseId || !testcases.length) return null;
		return testcases.find((tc) => tc.id === Number(testcaseId)) || null;
	}, [testcases, testcaseId]);

	useEffect(() => {
		const prevTestcaseId = prevTestcaseIdRef.current;
		const currentTestcaseId = testcaseId;

		if (prevTestcaseId && (!currentTestcaseId || prevTestcaseId !== currentTestcaseId)) {
			resetPlaygroundState();
			if (!currentTestcaseId) {
				usePlaygroundStore.getState().resetForTestcaseExit(promptId, prevTestcaseId);
			}
		}

		prevTestcaseIdRef.current = currentTestcaseId;
	}, [
		testcaseId,
		resetPlaygroundState,
		promptId,
	]);

	// Load testcase data into playground query state
	useEffect(() => {
		if (testcase) {
			const testcaseInput = testcase.input || "";
			setInputContent(testcaseInput);
			lastSavedInputRef.current = testcaseInput;

			const formattedExpectedOutput = formatTestcaseOutput(testcase.expectedOutput);
			const hasExpectedMetrics = hasVisibleMetrics(currentExpectedOutput);
			const incomingHasMetrics = hasVisibleMetrics(formattedExpectedOutput);
			// Keep richer local metrics after Save as expected when testcase API returns output without metrics.
			const mergedExpectedOutput =
				hasExpectedMetrics && !incomingHasMetrics && currentExpectedOutput
					? {
							...formattedExpectedOutput,
							tokens: currentExpectedOutput.tokens,
							cost: currentExpectedOutput.cost,
							response_time_ms: currentExpectedOutput.response_time_ms,
							status: currentExpectedOutput.status,
						}
					: formattedExpectedOutput;
				const isExpectedUnchanged = isSameOutputSnapshot(
					currentExpectedOutput,
					mergedExpectedOutput,
				);

			if (!isExpectedUnchanged) {
				setExpectedOutput(mergedExpectedOutput);
			}

			const formattedLastOutput = formatTestcaseOutput(testcase.lastOutput);
			if (
				formattedLastOutput &&
				formattedLastOutput.answer !== undefined &&
				formattedLastOutput.answer !== null
			) {
				const hasOutputMetrics = hasVisibleMetrics(storeOutputContent);
				const incomingHasOutputMetrics = hasVisibleMetrics(formattedLastOutput);
				const mergedLastOutput =
					hasOutputMetrics && !incomingHasOutputMetrics && storeOutputContent
						? {
								...formattedLastOutput,
								tokens: storeOutputContent.tokens,
								cost: storeOutputContent.cost,
								response_time_ms: storeOutputContent.response_time_ms,
								status: storeOutputContent.status,
							}
						: formattedLastOutput;

					const isUnchanged = isSameOutputSnapshot(storeOutputContent, mergedLastOutput);

				if (!isUnchanged) {
					setOutputContent(mergedLastOutput);
				}
			}

			setCurrentExpectedThoughts(testcase.expectedChainOfThoughts || "");
			setTestcaseLoadState({ loaded: true });
		}
	}, [
		testcase,
		storeOutputContent,
		currentExpectedOutput,
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
		usePlaygroundStore.getState().resetAfterAddTestcase(promptId);
		clearExpectedOutputRef.current?.();
		window.dispatchEvent(new CustomEvent("testcaseUpdated"));
	}, [
		promptId,
	]);

	const handleSaveAsExpected = useCallback(
		async (newExpectedContent: UpdateExpected) => {
			const metricsSource = newExpectedContent.metrics ?? storeOutputContent ?? emptyPromptResponse;
			const expectedOutputData: PromptResponse = {
				answer: newExpectedContent.answer,
				tokens: metricsSource.tokens,
				cost: metricsSource.cost,
				response_time_ms: metricsSource.response_time_ms,
				status: metricsSource.status,
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
				if (promptId) {
					queryClient.invalidateQueries({
						queryKey: testcaseKeys.promptTestcases(promptId),
					});
					queryClient.invalidateQueries({
						queryKey: testcaseKeys.statusCounts(promptId),
					});
				}
			} catch (error) {
				console.error("Failed to save as expected:", error);
			}
		},
		[
			currentExpectedThoughts,
			promptId,
			setExpectedOutput,
			storeOutputContent,
			testcaseId,
			queryClient,
		],
	);

	const handleInputBlur = useCallback(async () => {
		if (!testcaseId) return;

		if (inputContent !== lastSavedInputRef.current) {
			try {
				await updateTestcaseInputMutation.mutateAsync(inputContent);
			} catch (error) {
				console.error("Failed to update testcase input:", error);
			}
		}
	}, [inputContent, testcaseId, updateTestcaseInputMutation]);

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
