import { flexRender, useReactTable, getCoreRowModel, getSortedRowModel } from "@tanstack/react-table";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useParams } from "react-router-dom";
import DeleteConfirmDialog from "@/components/dialogs/DeleteConfirmDialog";
import useMemoryColumns from "./hooks/useMemoryColumns";
import type { MemoryTypes } from "./hooks/useMemoryColumns";
import { CirclePlus } from "lucide-react";
import { CaretUp, CaretDown } from "phosphor-react";
import CreateMemoryDialog from "@/components/dialogs/CreateMemoryDialog";
import EditMemoryDialog from "@/components/dialogs/EditMemoryDialog";
import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "@/hooks/useToast";
import { SearchInput } from "@/components/ui/searchInput";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import { promptApi } from "@/api/prompt";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { usePromptMemories, promptMemoriesQueryKey } from "@/hooks/usePromptMemories";

interface Memory {
	id: number;
	key: string;	
	value: string;
	promptId?: number;
	updatedAt?: string;
	createdAt?: string;
}

export default function Memory() {
	const [createMemoryModal, setCreateMemoryModal] = useState(false);
	const [editMemoryModal, setEditMemoryModal] = useState(false);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [selectedMemory, setSelectedMemory] = useState<MemoryTypes | null>(null);
	const [editingMemory, setEditingMemory] = useState<Memory | undefined>(undefined);
	const [search, setSearch] = useState("");
	const [sorting, setSorting] = useState<SortingState>([]);

	const { id } = useParams<{ id: string }>();
	const [currentPromptId, setCurrentPromptId] = useState(id);
	const promptId = id ? Number(id) : undefined;

	const queryClient = useQueryClient();
	const { data: memories = [], isLoading } = usePromptMemories(promptId);

	// --- mutations ---
	const createMemoryMutation = useMutation({
		mutationFn: ({ key, value }: { key: string; value: string }) => {
			if (!id) throw new Error("No prompt id");
			return promptApi.createMemory(id, { key, value });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: promptMemoriesQueryKey(promptId) });
			setCreateMemoryModal(false);
		},
		onError: () => {
			toast({ title: "Something went wrong", variant: "destructive" });
		},
	});

	const editMemoryMutation = useMutation({
		mutationFn: ({ memoryId, value }: { memoryId: number; value: string }) => {
			if (!id) throw new Error("No prompt id");
			return promptApi.updateMemory(id, memoryId, { value });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: promptMemoriesQueryKey(promptId) });
			setEditMemoryModal(false);
			setEditingMemory(undefined);
		},
		onError: () => {
			toast({ title: "Something went wrong", variant: "destructive" });
		},
	});

	const deleteMemoryMutation = useMutation({
		mutationFn: (memoryId: number) => {
			if (!id) throw new Error("No prompt id");
			return promptApi.deleteMemory(id, memoryId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: promptMemoriesQueryKey(promptId) });
			setConfirmModalOpen(false);
			setSelectedMemory(null);
		},
		onError: () => {
			toast({ title: "Something went wrong", variant: "destructive" });
		},
	});

	const handleRowClick = (memory: Memory, event: React.MouseEvent) => {
		const target = event.target as HTMLElement;
		if (target.closest("button") || target.closest('[role="button"]')) return;
		setEditingMemory(memory);
		setEditMemoryModal(true);
	};

	const handleEditClick = useCallback((memory: MemoryTypes) => {
		const memoryForEdit = {
			id: memory.id,
			key: memory.key,
			value: memory.value,
			promptId: memory.promptId,
			updatedAt: memory.updatedAt,
			createdAt: memory.createdAt,
		};
		setEditingMemory(memoryForEdit);
		setEditMemoryModal(true);
	}, []);

	const columns = useMemoryColumns({
		setConfirmModalOpen,
		setSelectedMemory,
		onEditClick: handleEditClick,
	});

	const filteredMemories = useMemo(() => {
		return memories.filter((memory: Memory) => {
			const q = search.toLowerCase();
			return (
				q === "" ||
				memory.key.toLowerCase().includes(q) ||
				memory.value.toLowerCase().includes(q)
			);
		});
	}, [memories, search]);

	const table = useReactTable<Memory>({
		data: filteredMemories || [],
		columns: columns as ColumnDef<Memory>[],
		getCoreRowModel: getCoreRowModel(),
		state: { sorting },
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		enableSortingRemoval: true,
	});

	const createMemoryHandler = async (key: string, value: string) => {
		if (!id) return;
		createMemoryMutation.mutate({ key, value });
	};

	const editMemoryHandler = async (value: string) => {
		if (!editingMemory || !id) return;
		editMemoryMutation.mutate({ memoryId: editingMemory.id, value });
	};

	const confirmationDeleteHandler = async () => {
		if (!selectedMemory || !id) return;
		deleteMemoryMutation.mutate(selectedMemory.id);
	};

	const getSortIcon = (column: { getIsSorted: () => false | "asc" | "desc" }) => {
		const isSorted = column.getIsSorted();
		if (isSorted === "asc") {
			return (
				<span className="flex flex-col ml-1">
					<CaretUp size={12} weight="bold" className="text-foreground" />
					<CaretDown size={12} weight="bold" className="text-muted-foreground -mt-1" />
				</span>
			);
		} else if (isSorted === "desc") {
			return (
				<span className="flex flex-col ml-1">
					<CaretUp size={12} weight="bold" className="text-muted-foreground" />
					<CaretDown size={12} weight="bold" className="text-foreground -mt-1" />
				</span>
			);
		} else {
			return (
				<span className="flex flex-col ml-1 opacity-50">
					<CaretUp size={12} weight="bold" />
					<CaretDown size={12} weight="bold" className="-mt-1" />
				</span>
			);
		}
	};

	useEffect(() => {
		if (id !== currentPromptId) {
			setSearch("");
			setSelectedMemory(null);
			setEditingMemory(undefined);
			setSorting([]);
			setCurrentPromptId(id);
		}
	}, [id, currentPromptId]);

	const isPending =
		createMemoryMutation.isPending ||
		editMemoryMutation.isPending ||
		deleteMemoryMutation.isPending;

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
						Create New Memory
					</Button>
				</div>

				<div className="rounded-md overflow-hidden relative">
					{isLoading && memories.length === 0 && (
						<div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
						</div>
					)}
					<Table>
						<TableHeader className="bg-muted text-muted-foreground text-sm font-medium leading-5">
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow
									key={headerGroup.id}
									className="[&_th:first-child]:text-left text-left [&_th:last-child]:text-right"
								>
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											className="h-auto py-4 px-[14px] text-left"
										>
											{header.column.getCanSort() ? (
												<button
													type="button"
													className="flex items-center gap-2 cursor-pointer select-none hover:bg-accent rounded px-2 py-1 -mx-2 -my-1 transition-colors w-full"
													onClick={header.column.getToggleSortingHandler()}
													title={
														header.column.getCanSort()
															? header.column.getNextSortingOrder() ===
																"asc"
																? "Sort ascending"
																: header.column.getNextSortingOrder() ===
																		"desc"
																	? "Sort descending"
																	: "Clear sort"
															: undefined
													}
												>
													{flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
													{getSortIcon(header.column)}
												</button>
											) : (
												flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)
											)}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>

						<TableBody>
							{table.getRowModel().rows.length > 0 &&
								table.getRowModel().rows.map((row) => (
									<TableRow
										key={row.id}
										className="cursor-pointer [&_td:first-child]:text-left [&_td:last-child]:text-right hover:bg-muted/50 transition-colors"
										onClick={(event) => handleRowClick(row.original, event)}
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id} className="text-left">
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
								))}
						</TableBody>
					</Table>
				</div>

				{!isLoading && table.getRowModel().rows.length === 0 && (
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
				confirmationHandler={editMemoryHandler}
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
