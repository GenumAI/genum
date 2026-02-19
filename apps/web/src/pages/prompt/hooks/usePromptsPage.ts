import { useCallback, useMemo, useState } from "react";
import {
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
	type SortingState,
} from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import { useProjectPrompts } from "@/hooks/useProjectPrompts";
import { useCreatePrompt } from "@/hooks/useCreatePrompt";
import { useDeletePrompt } from "@/hooks/useDeletePrompt";
import { useAddParamsToUrl } from "@/lib/addParamsToUrl";
import { useRefetchOnWorkspaceChange } from "@/hooks/useRefetchOnWorkspaceChange";
import { usePromptsTableColumns } from "./usePromptsTableColumns";
import { getNewPromptName } from "../utils/promptCounters";
import type { DeletePromptModalState, Prompt } from "../utils/types";

const defaultDeleteModalState: DeletePromptModalState = {
	open: false,
};

export function usePromptsPage() {
	const { prompts, loading: promptsLoading, removePromptLocally, addPromptLocally, refetch } =
		useProjectPrompts();
	const { createPrompt, loading: isCreatingPrompt } = useCreatePrompt();
	const { deletePrompt, loading: isDeletingPrompt } = useDeletePrompt();

	const [search, setSearch] = useState("");
	const [sorting, setSorting] = useState<SortingState>([]);
	const [deleteModal, setDeleteModal] = useState<DeletePromptModalState>(defaultDeleteModalState);

	const navigate = useNavigate();
	const addParamsToUrl = useAddParamsToUrl();

	useRefetchOnWorkspaceChange(() => {
		void refetch();
	});

	const handleDeletePromptClick = useCallback((prompt: Prompt) => {
		setDeleteModal({ open: true, prompt });
	}, []);

	const columns = usePromptsTableColumns({
		onDeletePrompt: handleDeletePromptClick,
	});

	const filteredData = useMemo(() => {
		return prompts.filter((prompt) => {
			return !search || prompt.name.toLowerCase().includes(search.toLowerCase());
		});
	}, [prompts, search]);

	const table = useReactTable({
		data: filteredData,
		columns,
		getCoreRowModel: getCoreRowModel(),
		state: {
			sorting,
		},
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
	});

	const handleRowClick = useCallback(
		(prompt: Prompt) => {
			navigate(addParamsToUrl(`/prompt/${prompt.id}/playground`));
		},
		[addParamsToUrl, navigate],
	);

	const handleCreatePrompt = useCallback(async () => {
		try {
			const promptName = getNewPromptName(prompts);
			const newPrompt = await createPrompt({ name: promptName, value: "" });

			if (!newPrompt?.id) return;

			addPromptLocally(newPrompt as Prompt);
			navigate(addParamsToUrl(`/prompt/${newPrompt.id}/playground`));
		} catch (err) {
			console.error("Error:", err);
		}
	}, [addParamsToUrl, addPromptLocally, createPrompt, navigate, prompts]);

	const handleDeleteConfirm = useCallback(
		async (promptId: number) => {
			const success = await deletePrompt(promptId);
			if (!success) return;

			removePromptLocally(promptId);
			setDeleteModal(defaultDeleteModalState);
		},
		[deletePrompt, removePromptLocally],
	);

	const handleDeleteModalOpenChange = useCallback((open: boolean) => {
		if (!open) {
			setDeleteModal(defaultDeleteModalState);
			return;
		}
		setDeleteModal((prev) => ({ ...prev, open }));
	}, []);

	return {
		table,
		search,
		setSearch,
		promptsLoading,
		columnsCount: columns.length,
		isCreatingPrompt,
		isDeletingPrompt,
		deleteModal,
		handleCreatePrompt,
		handleRowClick,
		handleDeleteConfirm,
		handleDeleteModalOpenChange,
	};
}
