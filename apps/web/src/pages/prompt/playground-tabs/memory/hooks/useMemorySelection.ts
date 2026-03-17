import { useCallback } from "react";
import usePlaygroundStore from "@/stores/playground.store";
import type { MemorySelectionState } from "@/stores/playground.store";

const DEFAULT_SELECTION: MemorySelectionState = {
	selectedMemoryId: "",
	selectedMemoryKeyName: "",
};

export const useMemorySelection = (promptId: number | undefined, testcaseId: string | null) => {
	const selection =
		usePlaygroundStore((state) => state.getMemorySelectionDraft(promptId, testcaseId)) ??
		DEFAULT_SELECTION;

	const setSelection = useCallback(
		(nextSelection: Partial<MemorySelectionState>) => {
			usePlaygroundStore
				.getState()
				.setMemorySelectionDraft(promptId, testcaseId, nextSelection);
		},
		[promptId, testcaseId],
	);

	return { selection, setSelection };
};
