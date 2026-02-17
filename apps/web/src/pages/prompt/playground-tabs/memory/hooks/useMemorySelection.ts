import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type MemorySelectionState = {
	selectedMemoryId: string;
	selectedMemoryKeyName: string;
};

const DEFAULT_SELECTION: MemorySelectionState = {
	selectedMemoryId: "",
	selectedMemoryKeyName: "",
};

export const memorySelectionQueryKey = (
	promptId: number | undefined,
	testcaseId: string | null,
) => ["memory-selection", promptId ?? "unknown", testcaseId ?? "prompt"] as const;

export const useMemorySelection = (promptId: number | undefined, testcaseId: string | null) => {
	const queryClient = useQueryClient();
	const queryKey = memorySelectionQueryKey(promptId, testcaseId);

	const { data: selection = DEFAULT_SELECTION } = useQuery({
		queryKey,
		queryFn: async () => DEFAULT_SELECTION,
		initialData: DEFAULT_SELECTION,
	});

	const setSelection = useCallback(
		(nextSelection: Partial<MemorySelectionState>) => {
			queryClient.setQueryData<MemorySelectionState>(queryKey, (previous) => ({
				...(previous ?? DEFAULT_SELECTION),
				...nextSelection,
			}));
		},
		[queryClient, queryKey],
	);

	return { selection, setSelection };
};
