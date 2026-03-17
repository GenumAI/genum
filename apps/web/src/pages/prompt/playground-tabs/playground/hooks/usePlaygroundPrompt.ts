import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Options } from "@/hooks/usePrompt";
import { usePromptById } from "@/hooks/usePrompt";
import { useToast } from "@/hooks/useToast";
import { usePromptStatus } from "@/contexts/PromptStatusContext";
import { useTestcaseStatusCounts } from "@/hooks/useTestcaseStatusCounts";
import usePromptStore from "@/stores/prompt.store";
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
		updatePrompt,
		prompt,
		loading: promptLoading,
		isUpdating: isUpdatingPromptContent,
		error: updatePromptError,
	} = usePromptById(promptId);

	useTestcaseStatusCounts(promptId);

	const serverPromptValue = prompt?.prompt?.value || "";
	const liveDraftValue = usePromptStore((state) => state.getPromptDraft(promptId));
	const livePromptValue = liveDraftValue ?? serverPromptValue;

	const setLivePromptValue = useCallback(
		(value: string) => {
			usePromptStore.getState().setPromptDraft(promptId, value);
		},
		[promptId],
	);

	const clearLivePromptValue = useCallback(() => {
		usePromptStore.getState().clearPromptDraft(promptId);
	}, [promptId]);
	const lastSavedValueRef = useRef(serverPromptValue);
	const pendingValueRef = useRef<string | null>(null);

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

	useEffect(() => {
		lastSavedValueRef.current = serverPromptValue;
		if (pendingValueRef.current === serverPromptValue) {
			pendingValueRef.current = null;
		}
	}, [serverPromptValue]);

	const updatePromptContent = useCallback(
		async (value: string, options?: UpdatePromptContentOptions) => {
			if (options?.isWithoutUpdate) return;

			const updateValue = options?.isEmpty ? "" : value;

			if (updateValue === serverPromptValue) {
				clearLivePromptValue();
				lastSavedValueRef.current = updateValue;
				return;
			}

			if (pendingValueRef.current === updateValue || lastSavedValueRef.current === updateValue) {
				return;
			}

			pendingValueRef.current = updateValue;

			try {
				await updatePrompt({ value: updateValue }, options as Options);
				lastSavedValueRef.current = updateValue;
				clearLivePromptValue();
			} catch (error) {
				console.error("Failed to update prompt content:", error);
				toast({
					title: "Failed to save prompt",
					description: "Could not save prompt. Please try again.",
					variant: "destructive",
				});
			} finally {
				if (pendingValueRef.current === updateValue) {
					pendingValueRef.current = null;
				}
			}
		},
		[
			serverPromptValue,
			clearLivePromptValue,
			toast,
			updatePrompt,
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
