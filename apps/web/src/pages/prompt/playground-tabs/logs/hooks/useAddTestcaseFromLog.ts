import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/useToast";
import { useCreateTestcase } from "@/hooks/useCreateTestcase";
import type { Log, MemoriesResponse } from "@/types/logs";
import { testcaseKeys } from "@/query-keys/testcases.keys";

interface UseAddTestcaseFromLogParams {
	promptId?: number;
	selectedLog: Log | null;
	memoriesData?: MemoriesResponse;
}

export function useAddTestcaseFromLog({
	promptId,
	selectedLog,
	memoriesData,
}: UseAddTestcaseFromLogParams) {
	const { toast } = useToast();
	const { createTestcase, loading: creatingTestcase } = useCreateTestcase();
	const queryClient = useQueryClient();

	const handleAddTestcaseFromLog = useCallback(async () => {
		if (!selectedLog) return;

		const targetPromptId = Number(selectedLog.prompt_id ?? promptId);
		if (!targetPromptId) return;

		try {
			let memoryId: number | null = null;
			if (selectedLog.memory_key && memoriesData?.memories) {
				const memory = memoriesData.memories.find((item) => item.key === selectedLog.memory_key);
				if (memory) memoryId = memory.id;
			}

			const ok = await createTestcase({
				promptId: targetPromptId,
				input: selectedLog.in || "",
				expectedOutput: selectedLog.out || "",
				lastOutput: selectedLog.out || "",
				memoryId,
			});

			if (ok) {
				toast({
					title: "Testcase added",
					description: "Testcase was created from log.",
					variant: "default",
				});

				queryClient.invalidateQueries({
					queryKey: testcaseKeys.promptTestcases(targetPromptId),
				});
				queryClient.invalidateQueries({
					queryKey: testcaseKeys.statusCounts(targetPromptId),
				});
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
	}, [createTestcase, memoriesData, promptId, queryClient, selectedLog, toast]);

	return {
		handleAddTestcaseFromLog,
		creatingTestcase,
	};
}
