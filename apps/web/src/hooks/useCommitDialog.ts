import { useCallback, useState } from "react";
import { promptApi } from "@/api/prompt";
import { toast } from "@/hooks/useToast";
import usePlaygroundStore from "@/stores/playground.store";
import { useShallow } from "zustand/react/shallow";

interface UseCommitDialogProps {
	promptId: number | string;
	onSuccess?: () => void;
}

export const useCommitDialog = ({ promptId, onSuccess }: UseCommitDialogProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const [isCommitting, setIsCommitting] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);

	const { value, setValue } = usePlaygroundStore(
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
			toast({
				title: "Changes committed successfully",
			});
			setValue(""); // Очищаем после успеха
			setIsOpen(false); // Закрываем после успеха
			onSuccess?.();
		} catch {
			toast({
				title: "Something went wrong",
				variant: "destructive",
			});
		} finally {
			setIsCommitting(false);
		}
	}, [value, promptId, onSuccess, setValue]);

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
