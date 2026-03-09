import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import { promptApi } from "@/api/prompt";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { helperKeys } from "@/query-keys/helpers.keys";
import { testcaseKeys } from "@/query-keys/testcases.keys";
import type { TestCase } from "@/types/TestСase";

interface UseInputGenerationProps {
	promptId?: number;
	systemPrompt?: string;
	onInputGenerated?: (value: string) => void;
}

export const useInputGeneration = ({
	promptId,
	systemPrompt,
	onInputGenerated,
}: UseInputGenerationProps) => {
	const { toast } = useToast();
	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");
	const queryClient = useQueryClient();

	const [aiQuery, setAiQuery] = useState("");
	const [isPopoverOpen, setIsPopoverOpen] = useState(false);

	const inputMutation = useMutation({
		mutationKey: helperKeys.generateInput(promptId),
		mutationFn: async (data: { query: string; systemPrompt: string }) => {
			if (!promptId) throw new Error("Prompt ID is required");
			return await promptApi.generateInput(promptId, data);
		},
	});

	const updateTestcaseInputMutation = useMutation({
		mutationKey: testcaseKeys.updateInput(testcaseId ?? undefined),
		mutationFn: async (input: string) => {
			if (!testcaseId) return;
			return testcasesApi.updateTestcase(testcaseId, { input });
		},
		onSuccess: (data) => {
			if (!testcaseId) return;
			const updatedTestcase = data?.testcase;
			if (!updatedTestcase) return;

			queryClient.setQueryData(testcaseKeys.byId(testcaseId), { testcase: updatedTestcase });
			if (promptId) {
				queryClient.setQueryData(
					testcaseKeys.promptTestcases(promptId),
					(prev: TestCase[] | undefined) =>
						prev?.map((tc) => (tc.id === updatedTestcase.id ? updatedTestcase : tc)) ?? prev,
				);
			}
		},
	});

	const handleGenerate = async () => {
		if (!promptId) return;

		try {
			const response = await inputMutation.mutateAsync({
				query: aiQuery || "",
				systemPrompt: systemPrompt || "",
			});

			if (response && response.input) {
				onInputGenerated?.(response.input);

				if (testcaseId) {
					await updateTestcaseInputMutation.mutateAsync(response.input);
				}

				toast({
					title: "Input generated",
					description: "Input was generated successfully",
					variant: "default",
				});
				
				setIsPopoverOpen(false);
				setAiQuery("");
			}
		} catch {
			toast({
				title: "Error",
				description: "Failed to generate and save input",
				variant: "destructive",
			});
		}
	};

	return {
		aiQuery,
		setAiQuery,
		isPopoverOpen,
		setIsPopoverOpen,
		handleGenerate,
		isLoading: inputMutation.isPending || updateTestcaseInputMutation.isPending,
	};
};
