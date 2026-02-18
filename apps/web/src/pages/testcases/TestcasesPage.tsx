import { useProjectPrompts } from "@/hooks/useProjectPrompts";
import DeleteConfirmDialog from "@/components/dialogs/DeleteConfirmDialog";
import { useTestcasesTable } from "@/pages/prompt/playground-tabs/testcases/hooks/useTestcasesTable";
import TestcasesToolbar from "@/pages/prompt/playground-tabs/testcases/components/TestcasesToolbar";
import TestcasesTable from "@/pages/prompt/playground-tabs/testcases/components/TestcasesTable";

export default function Testcases() {
	const { prompts } = useProjectPrompts();
	const {
		search,
		setSearch,
		selectedValues,
		filterState,
		setFilterState,
		runningRows,
		confirmModalOpen,
		setConfirmModalOpen,
		isRunning,
		isDeleting,
		table,
		runTestHandler,
		confirmationDeleteHandler,
		handleRowClick,
		handleFilterChange,
		getRowCount,
	} = useTestcasesTable({
		prompts,
		hidePromptColumn: false,
		resetOnWorkspaceChange: true,
	});

	return (
		<>
			<div className="space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full pt-6">
				<TestcasesToolbar
					search={search}
					onSearchChange={setSearch}
					prompts={prompts}
					filterState={filterState}
					onFilterStateChange={setFilterState}
					selectedValues={selectedValues}
					onFilterChange={handleFilterChange}
					onRunTests={runTestHandler}
					rowCount={getRowCount()}
					isRunning={isRunning}
					runningRowsCount={runningRows.length}
				/>

				<TestcasesTable table={table} onRowClick={handleRowClick} />
			</div>
			<DeleteConfirmDialog
				open={confirmModalOpen}
				setOpen={setConfirmModalOpen}
				confirmationHandler={confirmationDeleteHandler}
				loading={isDeleting}
			/>
		</>
	);
}
