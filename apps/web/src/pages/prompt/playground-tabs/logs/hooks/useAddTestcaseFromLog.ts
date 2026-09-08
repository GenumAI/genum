import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/useToast";
import { useCreateTestcase } from "@/hooks/useCreateTestcase";
import { promptApi } from "@/api/prompt/prompt.api";
import type { Log, LogDetail } from "@/types/logs";
import { testcaseKeys } from "@/query-keys/testcases.keys";

interface UseAddTestcaseFromLogParams {
	promptId?: number;
	selectedLog: Log | null;
	/**
	 * The payload of `selectedLog`. A testcase IS its input and output, so this is not
	 * optional context -- without it there is nothing to create, hence the guard below.
	 */
	logDetail: LogDetail | null;
}

export function useAddTestcaseFromLog({
	promptId,
	selectedLog,
	logDetail,
}: UseAddTestcaseFromLogParams) {
	const { toast } = useToast();
	const { createTestcase, loading: creatingTestcase } = useCreateTestcase();
	const queryClient = useQueryClient();

	const handleAddTestcaseFromLog = useCallback(async () => {
		// `logDetail` is still loading, or failed: creating a testcase now would silently
		// make an empty one.
		if (!selectedLog || !logDetail) return;

		const targetPromptId = Number(selectedLog.prompt_id ?? promptId);
		if (!targetPromptId) return;

		try {
			const { ok, unresolvedPlaceholders } = await createTestcase({
				promptId: targetPromptId,
				input: logDetail.in || "",
				expectedOutput: logDetail.out || "",
				lastOutput: logDetail.out || "",
				placeholders: logDetail.placeholders ?? {},
			});

			if (ok) {
				if (unresolvedPlaceholders.length > 0) {
					// A value that has since been renamed or deleted cannot transfer --
					// saying so here is the difference between a partial transfer and a
					// silent one.
					toast({
						title: "Testcase added",
						description: `Testcase was created from log, but these placeholders could not transfer: ${unresolvedPlaceholders.join(", ")}.`,
						variant: "default",
					});
				} else {
					toast({
						title: "Testcase added",
						description: "Testcase was created from log.",
						variant: "default",
					});
				}

				try {
					await queryClient.fetchQuery({
						queryKey: testcaseKeys.promptTestcases(targetPromptId),
						queryFn: async () => {
							const response = await promptApi.getPromptTestcases(targetPromptId);
							return response.testcases || [];
						},
					});
				} catch (error) {
					console.error(
						"Failed to refresh prompt testcases after create from log:",
						error,
					);
				}
				return;
			}

			toast({
				title: "Failed to add testcase",
				description: "Could not create testcase from log.",
				variant: "destructive",
			});
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Unknown error";
			toast({
				title: "Error",
				description: message,
				variant: "destructive",
			});
		}
	}, [createTestcase, logDetail, promptId, queryClient, selectedLog, toast]);

	return {
		handleAddTestcaseFromLog,
		creatingTestcase,
	};
}
