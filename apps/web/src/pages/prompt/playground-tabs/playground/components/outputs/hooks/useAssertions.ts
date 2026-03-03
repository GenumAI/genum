import { useEffect, useMemo, useCallback } from "react";
import debounce from "lodash.debounce";
import { usePromptById } from "@/hooks/usePrompt";
import { usePlaygroundAssertion } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundAssertion";
import { useToast } from "@/hooks/useToast";

interface UseAssertionsProps {
	promptId: number | undefined;
}

export const useAssertions = ({ promptId }: UseAssertionsProps) => {
	const { prompt, updatePrompt } = usePromptById(promptId);
	const { toast } = useToast();
	const { currentAssertionType, assertionValue, setAssertionValue } =
		usePlaygroundAssertion({
			promptId,
			serverAssertionType: prompt?.prompt?.assertionType,
			serverAssertionValue: prompt?.prompt?.assertionValue,
		});

	const handleUpdatePrompt = useCallback(
		async (data: { assertionType?: string; assertionValue?: string }) => {
			if (!promptId) return;
			try {
				await updatePrompt(data);
			} catch (error) {
				console.error("Failed to update prompt:", error);
				toast({
					title: "Something went wrong",
					variant: "destructive",
				});
			}
		},
		[promptId, toast, updatePrompt],
	);

	// Debounced update for assertion value
	const debouncedUpdateAssertionValue = useMemo(
		() =>
			debounce(async (value: string) => {
				if (promptId && currentAssertionType === "AI") {
					await handleUpdatePrompt({ assertionValue: value });
				}
			}, 500),
		[promptId, currentAssertionType, handleUpdatePrompt],
	);
	useEffect(() => () => debouncedUpdateAssertionValue.cancel(), [debouncedUpdateAssertionValue]);

	const handleAssertionTypeChange = useCallback(
		(value: string) => {
			if (promptId) {
				handleUpdatePrompt({ assertionType: value });
			}
		},
		[promptId, handleUpdatePrompt],
	);

	const handleAssertionValueChange = useCallback(
		(value: string) => {
			setAssertionValue(value);
		},
		[setAssertionValue],
	);

	const handleAssertionValueBlur = useCallback(
		(value: string) => {
			debouncedUpdateAssertionValue(value);
		},
		[debouncedUpdateAssertionValue],
	);

	return {
		currentAssertionType,
		assertionValue,
		handleAssertionTypeChange,
		handleAssertionValueChange,
		handleAssertionValueBlur,
	};
};
