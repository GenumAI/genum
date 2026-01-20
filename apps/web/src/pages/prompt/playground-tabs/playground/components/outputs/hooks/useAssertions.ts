import { useEffect, useMemo, useCallback } from "react";
import debounce from "lodash.debounce";
import { usePlaygroundActions, usePlaygroundTestcase } from "@/stores/playground.store";
import { usePromptById } from "@/hooks/usePrompt";
import { promptApi } from "@/api/prompt";
import { useToast } from "@/hooks/useToast";

interface UseAssertionsProps {
	promptId: number | undefined;
}

export const useAssertions = ({ promptId }: UseAssertionsProps) => {
	const { setCurrentAssertionType, setAssertionValue } = usePlaygroundActions();
	const { currentAssertionType, assertionValue } = usePlaygroundTestcase();
	const { prompt } = usePromptById(promptId);
	const { toast } = useToast();

	// Initialize from prompt data
	useEffect(() => {
		if (prompt?.prompt) {
			setCurrentAssertionType(prompt.prompt.assertionType || "AI");
			setAssertionValue(prompt.prompt.assertionValue || "");
		}
	}, [prompt?.prompt, setCurrentAssertionType, setAssertionValue]);

	// Listen to custom events for assertion type changes
	useEffect(() => {
		const handleAssertionTypeChange = (event: CustomEvent) => {
			const { assertionType: newAssertionType } = event.detail;
			if (newAssertionType && newAssertionType !== currentAssertionType) {
				setCurrentAssertionType(newAssertionType);
			}
		};

		window.addEventListener("assertionTypeChanged", handleAssertionTypeChange as EventListener);

		return () => {
			window.removeEventListener(
				"assertionTypeChanged",
				handleAssertionTypeChange as EventListener,
			);
		};
	}, [currentAssertionType, setCurrentAssertionType]);

	const handleUpdatePrompt = useCallback(
		async (data: Partial<any>) => {
			if (!promptId) return;
			try {
				await promptApi.updatePrompt(promptId, data);
			} catch (error) {
				console.error("Failed to update prompt:", error);
				toast({
					title: "Something went wrong",
					variant: "destructive",
				});
			}
		},
		[promptId, toast],
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

	const handleAssertionTypeChange = useCallback(
		(value: string) => {
			setCurrentAssertionType(value);

			window.dispatchEvent(
				new CustomEvent("assertionTypeChanged", {
					detail: { assertionType: value },
				}),
			);

			if (promptId) {
				handleUpdatePrompt({ assertionType: value });
			}
		},
		[promptId, setCurrentAssertionType, handleUpdatePrompt],
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
