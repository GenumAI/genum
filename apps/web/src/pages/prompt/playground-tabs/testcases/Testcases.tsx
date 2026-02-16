import { useParams } from "react-router-dom";
import DeleteConfirmDialog from "@/components/dialogs/DeleteConfirmDialog";
import { useTestcasesTable } from "./hooks/useTestcasesTable";
import TestcasesToolbar from "./components/TestcasesToolbar";
import TestcasesTable from "./components/TestcasesTable";

export default function Testcases() {
	const { id } = useParams<{ id: string; orgId: string; projectId: string }>();
	const promptId = id ? Number(id) : undefined;

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
	} = useTestcasesTable({ promptId });

	return (
		<>
			<div className="space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full pt-8">
				<TestcasesToolbar
					search={search}
					onSearchChange={setSearch}
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
