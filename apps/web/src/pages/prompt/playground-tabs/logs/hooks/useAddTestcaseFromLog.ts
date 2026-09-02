import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/useToast";
import { useCreateTestcase } from "@/hooks/useCreateTestcase";
import { promptApi } from "@/api/prompt/prompt.api";
import type { Log } from "@/types/logs";
import { testcaseKeys } from "@/query-keys/testcases.keys";

interface UseAddTestcaseFromLogParams {
	promptId?: number;
	selectedLog: Log | null;
}

export function useAddTestcaseFromLog({ promptId, selectedLog }: UseAddTestcaseFromLogParams) {
	const { toast } = useToast();
	const { createTestcase, loading: creatingTestcase } = useCreateTestcase();
	const queryClient = useQueryClient();

	const handleAddTestcaseFromLog = useCallback(async () => {
		if (!selectedLog) return;

		const targetPromptId = Number(selectedLog.prompt_id ?? promptId);
		if (!targetPromptId) return;

		try {
			const { ok, unresolvedPlaceholders } = await createTestcase({
				promptId: targetPromptId,
				input: selectedLog.in || "",
				expectedOutput: selectedLog.out || "",
				lastOutput: selectedLog.out || "",
				placeholders: selectedLog.placeholders ?? {},
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
	}, [createTestcase, promptId, queryClient, selectedLog, toast]);

	return {
		handleAddTestcaseFromLog,
		creatingTestcase,
	};
}
