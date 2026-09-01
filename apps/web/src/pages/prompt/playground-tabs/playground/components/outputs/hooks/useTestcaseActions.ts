import { useCallback } from "react";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { promptApi } from "@/api/prompt/prompt.api";
import type { TestcasePayload } from "@/hooks/useCreateTestcase";
import { useToast } from "@/hooks/useToast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import usePlaygroundStore from "@/stores/playground.store";
import { testcaseKeys } from "@/query-keys/testcases.keys";

interface UseTestcaseActionsProps {
	promptId: number | undefined;
	onTestcaseAdded?: () => void;
	selectedFiles?: Array<{ id: string }>;
}

export const useTestcaseActions = ({
	promptId,
	onTestcaseAdded,
	selectedFiles,
}: UseTestcaseActionsProps) => {
	const { toast } = useToast();
	const selectedPlaceholders = usePlaygroundStore((state) => state.selectedPlaceholders);
	const queryClient = useQueryClient();
	const createTestcaseMutation = useMutation({
		mutationKey: testcaseKeys.create(promptId),
		mutationFn: async (payload: TestcasePayload) => {
			return testcasesApi.createTestcase(payload);
		},
		onSuccess: async () => {
			if (!promptId) return;
			try {
				await queryClient.fetchQuery({
					queryKey: testcaseKeys.promptTestcases(promptId),
					queryFn: async () => {
						const response = await promptApi.getPromptTestcases(promptId);
						return response.testcases || [];
					},
				});
			} catch (error) {
				console.error("Failed to refresh prompt testcases after create:", error);
			}
			onTestcaseAdded?.();
		},
	});

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
				placeholders: selectedPlaceholders,
				files:
					selectedFiles && selectedFiles.length > 0
						? selectedFiles.map((f) => f.id)
						: undefined,
			};

			let success = false;

			try {
				await createTestcaseMutation.mutateAsync(createPayload);
				success = true;
			} catch (err) {
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
			}

			return { success };
		},
		[promptId, selectedPlaceholders, selectedFiles, toast, createTestcaseMutation],
	);

	return {
		isTestcaseLoading: createTestcaseMutation.isPending,
		createTestcase,
	};
};
