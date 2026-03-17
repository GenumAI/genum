import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt";
import { toast } from "@/hooks/useToast";
import usePromptStore from "@/stores/prompt.store";
import { useShallow } from "zustand/react/shallow";
import { promptKeys } from "@/query-keys/prompt.keys";
import { versionKeys } from "@/query-keys/version.keys";

interface UseCommitDialogProps {
	promptId: number | string;
	onSuccess?: (commited: boolean) => void | Promise<void>;
}

export const useCommitDialog = ({ promptId, onSuccess }: UseCommitDialogProps) => {
	const queryClient = useQueryClient();
	const [isOpen, setIsOpen] = useState(false);
	const [isCommitting, setIsCommitting] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);

	const { value, setValue } = usePromptStore(
		useShallow((state) => ({
			value: state.commitMessage,
			setValue: state.setCommitMessage,
		})),
	);

	const onOpenChange = useCallback(
		(open: boolean) => {
			setIsOpen(open);
			if (!open) {
				setValue("");
			}
		},
		[setValue],
	);

	const handleGenerate = useCallback(async () => {
		if (!promptId) return;

		setIsGenerating(true);
		setValue("");

		try {
			const data = await promptApi.generateCommitMessage(promptId);
			if (data?.message) {
				setValue(data.message);
			}
		} catch {
			toast({
				title: "Failed to generate commit message",
				variant: "destructive",
			});
		} finally {
			setIsGenerating(false);
		}
	}, [promptId, setValue]);

	const handleCommit = useCallback(async () => {
		if (!value || !promptId) return;

		setIsCommitting(true);
		try {
			await promptApi.commitPrompt(promptId, { commitMessage: value });
			const promptResult = await promptApi.getPrompt(promptId);
			const commited = promptResult.prompt?.commited ?? false;
			await queryClient.invalidateQueries({ queryKey: promptKeys.byId(promptId) });
			await queryClient.invalidateQueries({ queryKey: versionKeys.versions(promptId) });
			toast({
				title: "Changes committed successfully",
			});
			setValue(""); // Очищаем после успеха
			setIsOpen(false); // Закрываем после успеха
			await onSuccess?.(commited);
		} catch {
			toast({
				title: "Something went wrong",
				variant: "destructive",
			});
		} finally {
			setIsCommitting(false);
		}
	}, [value, promptId, onSuccess, queryClient, setValue]);

	return {
		isOpen,
		setIsOpen: onOpenChange,
		value,
		setValue,
		isGenerating,
		isCommitting,
		handleGenerate,
		handleCommit,
	};
};
