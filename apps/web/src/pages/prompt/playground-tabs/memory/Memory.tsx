import { Button } from "@/components/ui/button";
import { useParams } from "react-router-dom";
import DeleteConfirmDialog from "@/components/dialogs/DeleteConfirmDialog";
import useMemoryColumns from "./hooks/useMemoryColumns";
import { CirclePlus } from "lucide-react";
import CreateMemoryDialog from "@/pages/prompt/playground-tabs/memory/components/CreateMemoryDialog";
import EditMemoryDialog from "@/components/dialogs/EditMemoryDialog";
import { useState, useEffect, useCallback } from "react";
import type { MouseEvent } from "react";
import { SearchInput } from "@/components/ui/searchInput";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import type { Memory as PromptMemory } from "@/api/prompt";
import { usePromptMemories } from "@/pages/prompt/playground-tabs/memory/hooks/usePromptMemories";
import { useMemoryMutations } from "./hooks/useMemoryMutations";
import { useMemoryFilters } from "./hooks/useMemoryFilters";
import MemoryTable from "./components/MemoryTable";

export default function Memory() {
	const [createMemoryModal, setCreateMemoryModal] = useState(false);
	const [editMemoryModal, setEditMemoryModal] = useState(false);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [selectedMemory, setSelectedMemory] = useState<PromptMemory | null>(null);
	const [editingMemory, setEditingMemory] = useState<PromptMemory | undefined>(undefined);

	const { id } = useParams<{ id: string }>();
	const [currentPromptId, setCurrentPromptId] = useState(id);
	const promptId = id ? Number(id) : undefined;

	const { data: memories = [], isLoading } = usePromptMemories(promptId);
	const { search, setSearch, sorting, setSorting, filteredMemories } = useMemoryFilters({
		memories,
		promptId: id,
	});

	const { createMemoryHandler, editMemoryHandler, deleteMemoryHandler, isPending } =
		useMemoryMutations({
			promptId,
			onCreateSuccess: () => {
				setCreateMemoryModal(false);
			},
			onEditSuccess: () => {
				setEditMemoryModal(false);
				setEditingMemory(undefined);
			},
			onDeleteSuccess: () => {
				setConfirmModalOpen(false);
				setSelectedMemory(null);
			},
		});

	const handleRowClick = (memory: PromptMemory, event: MouseEvent<HTMLTableRowElement>) => {
		const target = event.target as HTMLElement;
		if (target.closest("button") || target.closest('[role="button"]')) return;
		setEditingMemory(memory);
		setEditMemoryModal(true);
	};

	const handleEditClick = useCallback((memory: PromptMemory) => {
		setEditingMemory(memory);
		setEditMemoryModal(true);
	}, []);

	const columns = useMemoryColumns({
		setConfirmModalOpen,
		setSelectedMemory,
		onEditClick: handleEditClick,
	});

	const handleEditMemory = (value: string) => {
		if (!editingMemory) return;
		editMemoryHandler(editingMemory.id, value);
	};

	const confirmationDeleteHandler = () => {
		if (!selectedMemory) return;
		deleteMemoryHandler(selectedMemory.id);
	};

	useEffect(() => {
		if (id !== currentPromptId) {
			setSelectedMemory(null);
			setEditingMemory(undefined);
			setCurrentPromptId(id);
		}
	}, [id, currentPromptId]);

	return (
		<>
			<div className="space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full pt-8 bg-background text-foreground">
				<div className="flex justify-between">
					<div className="flex items-center gap-3">
						<SearchInput
							placeholder="Search..."
							className="min-w-[241px]"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					<Button className="px-7" onClick={() => setCreateMemoryModal(true)}>
						<CirclePlus className="mr-2 h-4 w-4" />
						Create Memory
					</Button>
				</div>

				<MemoryTable
					memories={filteredMemories}
					columns={columns}
					sorting={sorting}
					onSortingChange={setSorting}
					isLoading={isLoading}
					onRowClick={handleRowClick}
				/>

				{!isLoading && filteredMemories.length === 0 && (
					<EmptyState
						title="No data"
						description={
							search
								? "No results found with the current search."
								: "No memory keys found. Create one to begin."
						}
					/>
				)}
			</div>

			<CreateMemoryDialog
				open={createMemoryModal}
				setOpen={setCreateMemoryModal}
				confirmationHandler={createMemoryHandler}
				loading={isPending}
			/>

			<EditMemoryDialog
				open={editMemoryModal}
				setOpen={setEditMemoryModal}
				confirmationHandler={handleEditMemory}
				loading={isPending}
				initialData={editingMemory}
			/>

			<DeleteConfirmDialog
				open={confirmModalOpen}
				setOpen={setConfirmModalOpen}
				confirmationHandler={confirmationDeleteHandler}
				loading={isPending}
			/>
		</>
	);
}
