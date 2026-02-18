import { useState, useCallback } from "react";
import { testcasesApi } from "@/api/testcases/testcases.api";
import type { TestcasePayload } from "@/hooks/useCreateTestcase";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import { useMemorySelection } from "@/pages/prompt/playground-tabs/memory/hooks/useMemorySelection";

interface UseTestcaseActionsProps {
	promptId: number | undefined;
	onTestcaseAdded?: () => void;
	selectedFiles?: Array<{ id: string }>;
}

export const useTestcaseActions = ({ promptId, onTestcaseAdded, selectedFiles }: UseTestcaseActionsProps) => {
	const [isTestcaseLoading, setIsTestcaseLoading] = useState(false);
	const { toast } = useToast();
	const { selection } = useMemorySelection(promptId, null);
	const selectedMemoryId = selection.selectedMemoryId;
	const queryClient = useQueryClient();

	const createTestcase = useCallback(
		async (input: string, expectedOutput: string, lastOutput: string) => {
			if (!promptId) {
				toast({
					title: "Failed to add test case",
					description: "Prompt ID is missing.",
					variant: "destructive",
				});
				return { success: false };
			}

			const createPayload: TestcasePayload = {
				promptId: Number(promptId),
				input: input || "",
				expectedOutput: expectedOutput,
				lastOutput: lastOutput || "",
				memoryId: selectedMemoryId ? Number(selectedMemoryId) : undefined,
				files: selectedFiles && selectedFiles.length > 0 ? selectedFiles.map((f) => f.id) : undefined,
			};

			setIsTestcaseLoading(true);
			let success = false;

			try {
				await testcasesApi.createTestcase(createPayload);
				success = true;

				if (promptId) {
					queryClient.invalidateQueries({
						queryKey: ["prompt-testcases", promptId],
					});
					queryClient.invalidateQueries({
						queryKey: ["testcase-status-counts", promptId],
					});
				}
				onTestcaseAdded?.();
			} catch (err: any) {
				console.error("Create testcase error:", err);
				success = false;
			} finally {
				toast({
					title: success ? "Test case added" : "Failed to add test case",
					description: success
						? "Your test case was saved successfully."
						: "Unknown error, try again.",
					variant: success ? "default" : "destructive",
				});
				setIsTestcaseLoading(false);
			}

			return { success };
		},
		[promptId, selectedMemoryId, selectedFiles, onTestcaseAdded, toast, queryClient],
	);

	return {
		isTestcaseLoading,
		createTestcase,
	};
};
