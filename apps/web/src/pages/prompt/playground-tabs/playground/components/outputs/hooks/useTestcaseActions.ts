import { useCallback } from "react";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { promptApi } from "@/api/prompt/prompt.api";
import type { TestcasePayload } from "@/hooks/useCreateTestcase";
import { useToast } from "@/hooks/useToast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlaceholderSelection } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaceholderSelection";
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
	// The same reading the run uses. Posting the raw store here is what reported a key
	// as "could not transfer" that the run had already dropped without a word -- the
	// selection was dead either way, and only one of the two surfaces said so.
	const { selection: placeholderSelection } = usePlaceholderSelection(promptId);
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
				placeholders: placeholderSelection,
				files:
					selectedFiles && selectedFiles.length > 0
						? selectedFiles.map((f) => f.id)
						: undefined,
			};

			let success = false;
			let unresolvedPlaceholders: string[] = [];

			try {
				const response = await createTestcaseMutation.mutateAsync(createPayload);
				unresolvedPlaceholders = response.unresolvedPlaceholders ?? [];
				success = true;
			} catch (err) {
				console.error("Create testcase error:", err);
				success = false;
			} finally {
				if (success && unresolvedPlaceholders.length > 0) {
					// A value that has since been renamed or deleted cannot transfer --
					// saying so here is the difference between a partial transfer and a
					// silent one. Matches useAddTestcaseFromLog's wording for the same case.
					toast({
						title: "Test case added",
						description: `Your test case was saved, but these placeholders could not transfer: ${unresolvedPlaceholders.join(", ")}.`,
						variant: "default",
					});
				} else {
					toast({
						title: success ? "Test case added" : "Failed to add test case",
						description: success
							? "Your test case was saved successfully."
							: "Unknown error, try again.",
						variant: success ? "default" : "destructive",
					});
				}
			}

			return { success };
		},
		[promptId, placeholderSelection, selectedFiles, toast, createTestcaseMutation],
	);

	return {
		isTestcaseLoading: createTestcaseMutation.isPending,
		createTestcase,
	};
};
