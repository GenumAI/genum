import { useCallback } from "react";
import usePlaygroundStore from "@/stores/playground.store";

export function usePlaygroundInput({
	promptId,
	testcaseId,
}: {
	promptId: number | undefined;
	testcaseId: string | null;
}) {
	const inputContent = usePlaygroundStore((state) =>
		state.getInputDraft(promptId, testcaseId),
	);

	const setInputContent = useCallback(
		(value: string) => {
			usePlaygroundStore.getState().setInputDraft(promptId, testcaseId, value);
		},
		[promptId, testcaseId],
	);

	const clearInputContent = useCallback(() => {
		usePlaygroundStore.getState().clearInputDraft(promptId, testcaseId);
	}, [promptId, testcaseId]);

	return {
		inputContent,
		setInputContent,
		clearInputContent,
		hasInputContent: !!inputContent.trim(),
	};
}
