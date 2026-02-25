import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Options } from "@/hooks/usePrompt";
import { usePromptById } from "@/hooks/usePrompt";
import { useToast } from "@/hooks/useToast";
import { usePromptStatus } from "@/contexts/PromptStatusContext";
import { useTestcaseStatusCounts } from "@/hooks/useTestcaseStatusCounts";
import { usePlaygroundActions } from "@/stores/playground.store";
import { promptKeys } from "@/query-keys/prompt.keys";
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
	const queryClient = useQueryClient();
	const { toast } = useToast();
	const { setIsCommitted, setActivePromptId } = usePromptStatus();
	const { clearAllState, setCurrentAssertionType } = usePlaygroundActions();

	const {
		updatePromptName,
		prompt,
		loading: promptLoading,
		isUpdating: isUpdatingPromptContent,
		error: updatePromptError,
	} = usePromptById(promptId);

	useTestcaseStatusCounts(promptId);

	const draftKey = promptKeys.draft(promptId);
	const draftQuery = useQuery<string | undefined>({
		queryKey: draftKey,
		queryFn: () => undefined,
		enabled: false,
		staleTime: Infinity,
		gcTime: Infinity,
	});

	const serverPromptValue = prompt?.prompt?.value || "";
	const livePromptValue = draftQuery.data ?? serverPromptValue;

	const setLivePromptValue = useCallback(
		(value: string) => {
			queryClient.setQueryData<string>(draftKey, value);
		},
		[queryClient, draftKey],
	);

	const clearLivePromptValue = useCallback(() => {
		queryClient.removeQueries({ queryKey: draftKey, exact: true });
	}, [queryClient, draftKey]);

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
		if (updatePromptError?.includes("Prompt is not found") && orgId && projectId) {
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
