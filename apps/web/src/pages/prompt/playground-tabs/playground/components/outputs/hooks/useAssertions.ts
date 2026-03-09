import { useCallback } from "react";
import { usePlaygroundAssertion } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundAssertion";
import { useToast } from "@/hooks/useToast";
import { promptApi } from "@/api/prompt";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { promptKeys } from "@/query-keys/prompt.keys";
import type { PromptSettings } from "@/types/Prompt";

interface UseAssertionsProps {
	promptId: number | undefined;
	serverAssertionType?: string;
	serverAssertionValue?: string;
}

type PromptQueryData = {
	prompt?: PromptSettings;
};

export const useAssertions = ({
	promptId,
	serverAssertionType,
	serverAssertionValue,
}: UseAssertionsProps) => {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { currentAssertionType, assertionValue, setAssertionValue, setAssertionType } =
		usePlaygroundAssertion({
			promptId,
			serverAssertionType,
			serverAssertionValue,
		});

	const updatePromptAssertionMutation = useMutation<
		{ prompt: PromptSettings },
		Error,
		{ assertionType?: string; assertionValue?: string }
	>({
		mutationKey: promptKeys.update(promptId),
		mutationFn: async (data) => {
			if (!promptId) throw new Error("Prompt ID is required");
			return promptApi.updatePrompt(promptId, data);
		},
		onSuccess: (result) => {
			queryClient.setQueryData<PromptQueryData>(promptKeys.byId(promptId), (previous) => {
				if (!previous) return result;
				return {
					...previous,
					prompt: result.prompt || previous.prompt,
				};
			});
		},
		onError: (error) => {
			console.error("Failed to update prompt:", error);
			toast({
				title: "Something went wrong",
				variant: "destructive",
			});
		},
	});

	const handleUpdatePrompt = useCallback(
		async (data: { assertionType?: string; assertionValue?: string }) => {
			if (!promptId) return;
			await updatePromptAssertionMutation.mutateAsync(data);
		},
		[promptId, updatePromptAssertionMutation],
	);

	const handleAssertionTypeChange = useCallback(
		(value: string) => {
			if (promptId) {
				setAssertionType(value);
				handleUpdatePrompt({ assertionType: value });
			}
		},
		[promptId, setAssertionType, handleUpdatePrompt],
	);

	const handleAssertionValueChange = useCallback(
		(value: string) => {
			setAssertionValue(value);
		},
		[setAssertionValue],
	);

	const handleAssertionValueBlur = useCallback(
		(value: string) => {
			if (!promptId || currentAssertionType !== "AI") return;
			void handleUpdatePrompt({ assertionValue: value });
		},
		[promptId, currentAssertionType, handleUpdatePrompt],
	);

	return {
		currentAssertionType,
		assertionValue,
		handleAssertionTypeChange,
		handleAssertionValueChange,
		handleAssertionValueBlur,
	};
};
