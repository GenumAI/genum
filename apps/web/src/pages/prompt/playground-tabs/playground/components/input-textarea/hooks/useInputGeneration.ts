import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import { promptApi } from "@/api/prompt";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { usePlaygroundActions } from "@/stores/playground.store";

interface UseInputGenerationProps {
	promptId?: number;
	systemPrompt?: string;
}

export const useInputGeneration = ({ promptId, systemPrompt }: UseInputGenerationProps) => {
	const { setInputContent } = usePlaygroundActions();
	const { toast } = useToast();
	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");
	const queryClient = useQueryClient();

	const [aiQuery, setAiQuery] = useState("");
	const [isPopoverOpen, setIsPopoverOpen] = useState(false);

	const inputMutation = useMutation({
		mutationFn: async (data: { query: string; systemPrompt: string }) => {
			if (!promptId) throw new Error("Prompt ID is required");
			return await promptApi.generateInput(promptId, data);
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
				setInputContent(response.input);

				if (testcaseId) {
					await testcasesApi.updateTestcase(testcaseId, {
						input: response.input,
					});
					await queryClient.invalidateQueries({
						queryKey: ["testcaseById", testcaseId],
					});
				}

				toast({
					title: "Input generated",
					description: "Input was generated successfully",
					variant: "default",
				});
				
				setIsPopoverOpen(false);
				setAiQuery("");
			}
		} catch (e) {
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
		isLoading: inputMutation.isPending,
	};
};
