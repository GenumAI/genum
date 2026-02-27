import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Options } from "@/hooks/usePrompt";
import { usePromptById } from "@/hooks/usePrompt";
import { useToast } from "@/hooks/useToast";
import { usePromptStatus } from "@/contexts/PromptStatusContext";
import { useTestcaseStatusCounts } from "@/hooks/useTestcaseStatusCounts";
import usePlaygroundStore from "@/stores/playground.store";
import type { UpdatePromptContentOptions } from "./types";

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
		updatePromptName,
		prompt,
		loading: promptLoading,
		isUpdating: isUpdatingPromptContent,
		error: updatePromptError,
	} = usePromptById(promptId);

	useTestcaseStatusCounts(promptId);

	const serverPromptValue = prompt?.prompt?.value || "";
	const liveDraftValue = usePlaygroundStore((state) => state.getPromptDraft(promptId));
	const livePromptValue = liveDraftValue ?? serverPromptValue;

	const setLivePromptValue = useCallback(
		(value: string) => {
			usePlaygroundStore.getState().setPromptDraft(promptId, value);
		},
		[promptId],
	);

	const clearLivePromptValue = useCallback(() => {
		usePlaygroundStore.getState().clearPromptDraft(promptId);
	}, [promptId]);

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
			setActivePromptId(currentPromptId);
		}

		prevPromptIdRef.current = currentPromptId;
	}, [promptId, setActivePromptId]);

	// Redirect if prompt no longer exists
	useEffect(() => {
		if (updatePromptError?.includes("Prompt is not found") && orgId && projectId) {
			navigate(`/${orgId}/${projectId}/prompts`, { replace: true });
		}
	}, [updatePromptError, orgId, projectId, navigate]);

	// Keep committed state in PromptStatusContext
	useEffect(() => {
		if (prompt?.prompt) {
			const promptCommitted = prompt.prompt.commited || false;
			setIsCommitted(promptCommitted);
		}
	}, [prompt?.prompt, setIsCommitted]);

	const updatePromptContent = useCallback(
		async (value: string, options?: UpdatePromptContentOptions) => {
			if (options?.isWithoutUpdate) return;

			const updateValue = options?.isEmpty ? "" : value;
			setLivePromptValue(updateValue);

			if (updateValue === serverPromptValue) {
				clearLivePromptValue();
				return;
			}

			try {
				setIsCommitted(false);
				await updatePromptName({ value: updateValue }, options as Options);
				clearLivePromptValue();
			} catch (error) {
				console.error("Failed to update prompt content:", error);
			}
		},
		[
			serverPromptValue,
			setLivePromptValue,
			clearLivePromptValue,
			setIsCommitted,
			updatePromptName,
		],
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
		originalPromptContent: serverPromptValue,
		livePromptValue,
		hasPromptContent: !!livePromptValue.trim(),
		isUpdatingPromptContent,
		setLivePromptValue,
	};
}
