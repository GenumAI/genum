import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Options } from "@/hooks/usePrompt";
import { usePromptById } from "@/hooks/usePrompt";
import { useToast } from "@/hooks/useToast";
import { usePromptStatus } from "@/contexts/PromptStatusContext";
import { useTestcaseStatusCounts } from "@/hooks/useTestcaseStatusCounts";
import { usePlaygroundActions } from "@/stores/playground.store";

type UpdatePromptContentOptions = {
	isEmpty?: boolean;
	isFormattingOnly?: boolean;
} & Options;

export function usePlaygroundPrompt({
	promptId,
	orgId,
	projectId,
}: {
	promptId: number | undefined;
	orgId: string | undefined;
	projectId: string | undefined;
}) {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { setIsCommitted, setActivePromptId } = usePromptStatus();
	const {
		clearAllState,
		setCurrentAssertionType,
		setOriginalPromptContent,
		setUpdatingPromptContent,
	} = usePlaygroundActions();

	const {
		updatePromptName,
		prompt,
		loading: promptLoading,
		error: updatePromptError,
	} = usePromptById(promptId);

	useTestcaseStatusCounts(promptId);

	// Cleanup + prompt switching behavior
	const prevPromptIdRef = useRef<number | undefined>(promptId);
	useEffect(() => {
		setActivePromptId(promptId);
		return () => setActivePromptId(undefined);
	}, [promptId, setActivePromptId]);

	useEffect(() => {
		const prevPromptId = prevPromptIdRef.current;
		const currentPromptId = promptId;

		if (prevPromptId !== undefined && prevPromptId !== currentPromptId) {
			clearAllState();
			setActivePromptId(currentPromptId);
		}

		prevPromptIdRef.current = currentPromptId;
	}, [promptId, clearAllState, setActivePromptId]);

	// Redirect if prompt no longer exists
	useEffect(() => {
		if (
			updatePromptError &&
			updatePromptError.includes("Prompt is not found") &&
			orgId &&
			projectId
		) {
			navigate(`/${orgId}/${projectId}/prompts`, { replace: true });
		}
	}, [updatePromptError, orgId, projectId, navigate]);

	// Sync prompt assertion type into store
	useEffect(() => {
		if (prompt?.prompt?.assertionType) {
			setCurrentAssertionType(prompt.prompt.assertionType);
		}
	}, [prompt?.prompt?.assertionType, setCurrentAssertionType]);

	// Keep committed state in PromptStatusContext
	useEffect(() => {
		if (prompt?.prompt) {
			const promptCommitted = prompt.prompt.commited || false;
			setIsCommitted(promptCommitted);
		}
	}, [prompt?.prompt, setIsCommitted]);

	const isUpdatingPromptContentRef = useRef(false);

	// Keep store original prompt content in sync (but don't fight in-flight updates)
	useEffect(() => {
		const currentContent = prompt?.prompt?.value || "";
		if (!isUpdatingPromptContentRef.current) {
			setOriginalPromptContent(currentContent);
		}
	}, [prompt?.prompt?.value, setOriginalPromptContent]);

	const updatePromptContent = useCallback(
		async (value: string, options?: UpdatePromptContentOptions) => {
		if (isUpdatingPromptContentRef.current) return;

		if (options?.isWithoutUpdate) {
			// Note: isUncommitted functionality might need to be handled elsewhere
			return;
		}

		isUpdatingPromptContentRef.current = true;
		setUpdatingPromptContent(true);

		try {
			const currentPromptValue = prompt?.prompt?.value || "";
			const updateValue = options?.isEmpty ? "" : value;

			if (updateValue !== currentPromptValue) {
				setIsCommitted(false);
				await updatePromptName({ value: updateValue }, options as Options);
			}
		} catch (error) {
			console.error("Failed to update prompt content:", error);
		} finally {
			isUpdatingPromptContentRef.current = false;
			setUpdatingPromptContent(false);
		}
		},
		[prompt?.prompt?.value, setUpdatingPromptContent, setIsCommitted, updatePromptName],
	);

	const handlePromptUpdate = useCallback(
		async (newPrompt: string) => {
			await updatePromptContent(newPrompt);

			if (updatePromptError) {
				toast({
					title: "Update failed",
					description: "Failed to update system instructions.",
					variant: "destructive",
				});
			} else {
				toast({
					title: "Prompt updated",
					description: "System instructions have been updated successfully.",
				});
			}
		},
		[toast, updatePromptContent, updatePromptError],
	);

	return {
		prompt,
		promptLoading,
		updatePromptError,
		updatePromptContent,
		handlePromptUpdate,
	};
}


