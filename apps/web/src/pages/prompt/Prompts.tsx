import { DeletePromptDialog } from "./components/DeletePromptDialog";
import { PromptsTable } from "./components/PromptsTable";
import { PromptsToolbar } from "./components/PromptsToolbar";
import { usePromptsPage } from "./hooks/usePromptsPage";

export default function Prompts() {
	const {
		table,
		search,
		setSearch,
		promptsLoading,
		columnsCount,
		isCreatingPrompt,
		isDeletingPrompt,
		deleteModal,
		handleCreatePrompt,
		handleRowClick,
		handleDeleteConfirm,
		handleDeleteModalOpenChange,
	} = usePromptsPage();

	return (
		<>
			<div className="space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full pt-6">
				<PromptsToolbar
					search={search}
					onSearchChange={setSearch}
					onCreatePrompt={handleCreatePrompt}
					isCreating={isCreatingPrompt}
				/>
				<PromptsTable
					table={table}
					isLoading={promptsLoading}
					columnsCount={columnsCount}
					onRowClick={handleRowClick}
				/>
			</div>

			<DeletePromptDialog
				state={deleteModal}
				isDeleting={isDeletingPrompt}
				onOpenChange={handleDeleteModalOpenChange}
				onConfirmDelete={handleDeleteConfirm}
			/>
		</>
	);
}
