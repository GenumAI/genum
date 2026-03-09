import { useCallback } from "react";
import type { PromptResponse } from "@/api/prompt";
import usePlaygroundStore from "@/stores/playground.store";

export function usePlaygroundOutput({
	promptId,
	testcaseId,
}: {
	promptId: number | undefined;
	testcaseId: string | null;
}) {
	const outputContent = usePlaygroundStore((state) =>
		state.getOutputDraft(promptId, testcaseId),
	);
	const expectedOutput = usePlaygroundStore((state) =>
		state.getExpectedOutputDraft(promptId, testcaseId),
	);
	const currentExpectedThoughts = usePlaygroundStore((state) =>
		state.getExpectedThoughtsDraft(promptId, testcaseId),
	);

	const setOutputContent = useCallback(
		(value: PromptResponse | null) => {
			usePlaygroundStore.getState().setOutputDraft(promptId, testcaseId, value);
		},
		[promptId, testcaseId],
	);

	const setExpectedOutput = useCallback(
		(value: PromptResponse | null) => {
			usePlaygroundStore.getState().setExpectedOutputDraft(promptId, testcaseId, value);
		},
		[promptId, testcaseId],
	);

	const setCurrentExpectedThoughts = useCallback(
		(value: string) => {
			usePlaygroundStore.getState().setExpectedThoughtsDraft(promptId, testcaseId, value);
		},
		[promptId, testcaseId],
	);

	const clearOutput = useCallback(() => {
		usePlaygroundStore.getState().setOutputDraft(promptId, testcaseId, null);
	}, [promptId, testcaseId]);

	const resetOutputState = useCallback(() => {
		usePlaygroundStore.getState().clearOutputDrafts(promptId, testcaseId);
	}, [promptId, testcaseId]);

	return {
		outputContent,
		expectedOutput,
		currentExpectedThoughts,
		setOutputContent,
		setExpectedOutput,
		setCurrentExpectedThoughts,
		clearOutput,
		resetOutputState,
	};
}
