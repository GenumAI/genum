import { useParams } from "react-router-dom";
import DeleteConfirmDialog from "@/components/dialogs/DeleteConfirmDialog";
import { useTestcasesTable } from "./hooks/useTestcasesTable";
import TestcasesToolbar from "./components/TestcasesToolbar";
import TestcasesTable from "./components/TestcasesTable";

export default function Testcases() {
	const { id, tab } = useParams<{ id: string; orgId: string; projectId: string; tab: string }>();
	const promptId = id ? Number(id) : undefined;
	const isActive = tab === "testcases";

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
	} = useTestcasesTable({ promptId, isActive });

	return (
		<>
			<div className="w-full max-w-[1232px] space-y-6 px-3 pt-8 lg:pr-6 2xl-plus:w-[70%] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px]">
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
