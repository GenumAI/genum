import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PromptResponse } from "@/api/prompt";
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

const isSameOutputSnapshot = (first?: PromptResponse | null, second?: PromptResponse | null) => {
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
	isTestcasesLoading,
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
	isTestcasesLoading: boolean;
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
			return testcasesApi.updateTestcase(testcaseId, { input: value });
		},
		onSuccess: (data, value) => {
			lastSavedInputRef.current = value;
			if (!testcaseId) return;
			const updatedTestcase = data?.testcase;

			queryClient.setQueryData(testcaseKeys.byId(testcaseId), (prev: any) => {
				if (updatedTestcase) return { testcase: updatedTestcase };
				if (!prev?.testcase) return prev;
				return {
					...prev,
					testcase: {
						...prev.testcase,
						input: value,
					},
				};
			});

			if (promptId) {
				queryClient.setQueryData(
					testcaseKeys.promptTestcases(promptId),
					(prev: TestCase[] | undefined) => {
						if (!prev?.length) return prev;
						return prev.map((tc) => {
							if (tc.id !== Number(testcaseId)) return tc;
							if (updatedTestcase) return updatedTestcase;
							return {
								...tc,
								input: value,
							};
						});
					},
				);
			}
		},
	});
	const { mutateAsync: updateExpectedAsync } = useMutation({
		mutationKey: testcaseKeys.updateExpected(testcaseId ?? undefined),
		mutationFn: async (updateData: {
			expectedOutput: string;
			expectedChainOfThoughts: string;
		}) => {
			if (!testcaseId) return;
			return testcasesApi.updateTestcase(testcaseId, updateData);
		},
		onSuccess: (data) => {
			if (!testcaseId) return;
			const updatedTestcase = data?.testcase;
			if (!updatedTestcase) return;

			queryClient.setQueryData(testcaseKeys.byId(testcaseId), { testcase: updatedTestcase });
			if (promptId) {
				queryClient.setQueryData(
					testcaseKeys.promptTestcases(promptId),
					(prev: TestCase[] | undefined) =>
						prev?.map((tc) => (tc.id === updatedTestcase.id ? updatedTestcase : tc)) ??
						prev,
				);
			}
		},
	});

	const testcase = useMemo(() => {
		if (!testcaseId || !testcases.length) return null;
		return testcases.find((tc) => tc.id === Number(testcaseId)) || null;
	}, [testcases, testcaseId]);

	// The playground's placeholder chips are seeded from the selected testcase's pinned
	// selection (Task 8) so the chips show -- and the run sends -- what will actually be
	// used. `pinnedPlaceholders` is recomputed whenever `testcase` changes, but its
	// *reference* is only rebuilt below when the pin's actual content changes: an
	// unrelated testcase mutation (saving the input, saving an expected output) hands
	// back a brand-new testcase object, and often a brand-new placeholderValues array,
	// carrying the same pinned content. Reacting to that by reference would replay the
	// seed on every such save and silently discard a manual chip choice the user made
	// for this run only.
	const pinnedPlaceholders = useMemo(() => {
		const result: Record<string, string> = {};
		for (const pinned of testcase?.placeholderValues ?? []) {
			result[pinned.placeholderValue.placeholder.key] = pinned.placeholderValue.name;
		}
		return result;
	}, [testcase]);
	// A pending testcaseId whose data has not loaded yet must produce a key distinct
	// from "no pin" ({}), or the transition from "waiting" to "loaded with no pin" (both
	// serialize to the same "{}") would never register as a dependency change below, and
	// the seed would never actually run for that testcase. `isTestcasesLoading` (not just
	// `!testcase`) is what tells "still fetching" apart from "fetched, and this id simply
	// doesn't belong to the current prompt" (e.g. a stale testcaseId left over from a
	// prompt switch) -- the latter must clear the selection, not wait forever.
	const isTestcaseUnresolved = Boolean(testcaseId) && !testcase && isTestcasesLoading;
	const pinnedPlaceholdersKey = useMemo(
		() => (isTestcaseUnresolved ? "__pending__" : JSON.stringify(pinnedPlaceholders)),
		[isTestcaseUnresolved, pinnedPlaceholders],
	);

	// This effect intentionally depends on pinnedPlaceholdersKey (a content-derived
	// proxy), not on pinnedPlaceholders/testcase directly -- see the comment above
	// pinnedPlaceholders. Depending on those by reference would re-seed on every
	// unrelated testcase object reference churn, not only on a real prompt/testcase/pin
	// change, silently discarding a manual chip choice made for this run only.
	// biome-ignore lint/correctness/useExhaustiveDependencies: deliberate, see above
	useEffect(() => {
		// A testcaseId can be present before its data has loaded into `testcases` yet;
		// there is nothing to seed from in that instant, so wait rather than
		// transiently clearing a selection the user may already be looking at. Once the
		// list has loaded, proceed regardless of whether `testcase` resolved -- a
		// not-found id (stale from a prompt switch) must still clear the selection.
		if (testcaseId && !testcase && isTestcasesLoading) return;
		usePlaygroundStore.getState().replacePlaceholderSelections(pinnedPlaceholders);
	}, [promptId, testcaseId, pinnedPlaceholdersKey]);

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
	}, [testcaseId, resetPlaygroundState, promptId]);

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
			const hasLocalExpectedDraft =
				Boolean(testcaseId) &&
				currentExpectedOutput !== null &&
				(currentExpectedOutput?.answer ?? "") !== (formattedExpectedOutput?.answer ?? "");
			const isExpectedUnchanged = isSameOutputSnapshot(
				currentExpectedOutput,
				mergedExpectedOutput,
			);

			if (!hasLocalExpectedDraft && !isExpectedUnchanged) {
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
		testcaseId,
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
	}, [promptId]);

	const handleSaveAsExpected = useCallback(
		async (newExpectedContent: UpdateExpected) => {
			const metricsSource =
				newExpectedContent.metrics ?? storeOutputContent ?? emptyPromptResponse;
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

				await updateExpectedAsync(updateData);
			} catch (error) {
				console.error("Failed to save as expected:", error);
			}
		},
		[
			currentExpectedThoughts,
			setExpectedOutput,
			storeOutputContent,
			testcaseId,
			updateExpectedAsync,
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
