import { useMutation, useQueryClient } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt";
import { toast } from "@/hooks/useToast";
import { promptMemoriesQueryKey } from "@/pages/prompt/playground-tabs/memory/hooks/usePromptMemories";

interface UseMemoryMutationsOptions {
	promptId?: number;
	onCreateSuccess?: () => void;
	onEditSuccess?: () => void;
	onDeleteSuccess?: () => void;
}

export const useMemoryMutations = ({
	promptId,
	onCreateSuccess,
	onEditSuccess,
	onDeleteSuccess,
}: UseMemoryMutationsOptions) => {
	const queryClient = useQueryClient();

	const createMemoryMutation = useMutation({
		mutationFn: ({ key, value }: { key: string; value: string }) => {
			if (!promptId) throw new Error("No prompt id");
			return promptApi.createMemory(promptId, { key, value });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: promptMemoriesQueryKey(promptId) });
			onCreateSuccess?.();
		},
		onError: () => {
			toast({ title: "Something went wrong", variant: "destructive" });
		},
	});

	const editMemoryMutation = useMutation({
		mutationFn: ({ memoryId, value }: { memoryId: number; value: string }) => {
			if (!promptId) throw new Error("No prompt id");
			return promptApi.updateMemory(promptId, memoryId, { value });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: promptMemoriesQueryKey(promptId) });
			onEditSuccess?.();
		},
		onError: () => {
			toast({ title: "Something went wrong", variant: "destructive" });
		},
	});

	const deleteMemoryMutation = useMutation({
		mutationFn: (memoryId: number) => {
			if (!promptId) throw new Error("No prompt id");
			return promptApi.deleteMemory(promptId, memoryId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: promptMemoriesQueryKey(promptId) });
			onDeleteSuccess?.();
		},
		onError: () => {
			toast({ title: "Something went wrong", variant: "destructive" });
		},
	});

	const createMemoryHandler = (key: string, value: string) => {
		if (!promptId) return;
		createMemoryMutation.mutate({ key, value });
	};

	const editMemoryHandler = (memoryId: number, value: string) => {
		if (!promptId) return;
		editMemoryMutation.mutate({ memoryId, value });
	};

	const deleteMemoryHandler = (memoryId: number) => {
		if (!promptId) return;
		deleteMemoryMutation.mutate(memoryId);
	};

	return {
		createMemoryHandler,
		editMemoryHandler,
		deleteMemoryHandler,
		isPending:
			createMemoryMutation.isPending ||
			editMemoryMutation.isPending ||
			deleteMemoryMutation.isPending,
	};
};
