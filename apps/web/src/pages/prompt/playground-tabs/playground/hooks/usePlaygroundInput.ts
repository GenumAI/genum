import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { promptKeys } from "@/query-keys/prompt.keys";

export function usePlaygroundInput({
	promptId,
	testcaseId,
}: {
	promptId: number | undefined;
	testcaseId: string | null;
}) {
	const queryClient = useQueryClient();
	const inputDraftKey = promptKeys.inputDraft(promptId, testcaseId);

	const inputDraftQuery = useQuery<string | undefined>({
		queryKey: inputDraftKey,
		queryFn: () => undefined,
		enabled: false,
		staleTime: Infinity,
		gcTime: Infinity,
	});

	const inputContent = inputDraftQuery.data ?? "";

	const setInputContent = useCallback(
		(value: string) => {
			queryClient.setQueryData<string>(inputDraftKey, value);
		},
		[queryClient, inputDraftKey],
	);

	const clearInputContent = useCallback(() => {
		queryClient.removeQueries({ queryKey: inputDraftKey, exact: true });
	}, [queryClient, inputDraftKey]);

	return {
		inputContent,
		setInputContent,
		clearInputContent,
		hasInputContent: !!inputContent.trim(),
	};
}
