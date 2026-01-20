import { testcasesApi } from "@/api/testcases/testcases.api";
import {
	flexRender,
	useReactTable,
	getCoreRowModel,
	Row,
	SortingState,
	getSortedRowModel,
} from "@tanstack/react-table";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useMemo, useState, useEffect } from "react";
import useTestcasesColumns from "@/hooks/useTestcasesColumns";
import { useProjectPrompts } from "@/hooks/useProjectPrompts";
import TestCasesFilter from "@/pages/prompt/playground-tabs/testcases/TestCasesFilter";
import { testcasesFilter } from "@/lib/testcasesFilter";
import { useNavigate, useParams } from "react-router-dom";
import DeleteConfirmDialog from "@/components/dialogs/DeleteConfirmDialog";
import { SearchInput } from "@/components/ui/searchInput";
import ButtonWithDropdown from "@/components/ui/buttonWithDropdown";
import type { TestCase, TestStatus } from "@/types/TestСase";
import { useAddParamsToUrl } from "@/lib/addParamsToUrl";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import ActiveFilterChips from "@/pages/prompt/playground-tabs/testcases/ActiveFilterChips";
import {
	usePlaygroundTestcase,
	usePlaygroundActions,
	usePlaygroundUI,
} from "@/stores/playground.store";

type UsedOptionValue = "all" | "nok" | "selected" | "need_run" | "passed";

type UsedOption = {
	label: string;
	value: UsedOptionValue;
};

const usedOptions: UsedOption[] = [
	{ label: "All", value: "all" },
	{ label: "Need Run", value: "need_run" },
	{ label: "Passed", value: "passed" },
	{ label: "Failed", value: "nok" },
	{ label: "Selected", value: "selected" },
];

export type FilterState = {
	prompts?: number[];
	testcasesStatus: TestStatus[];
};

export default function Testcases() {
	const [search, setSearch] = useState("");
	const [selectedValues, setSelectedValues] = useState<UsedOptionValue[]>(["all"]);
	const [filterState, setFilterState] = useState<FilterState>({
		prompts: [],
		testcasesStatus: [],
	});
	const [runningRows, setRunningRows] = useState<number[]>([]);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [selectedTestcase, setSelectedTestcase] = useState<TestCase | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const [sorting, setSorting] = useState<SortingState>([]);

	const navigate = useNavigate();
	const addParamsToUrl = useAddParamsToUrl();
	const params = useParams();
	const projectParams = Object.values(params).filter(Boolean).join("/");

	const { prompts } = useProjectPrompts();
	const { fetchAllTestcases, updateSingleTestcase } = usePlaygroundActions();
	const { testcases } = usePlaygroundTestcase();
	const { isStatusCountsLoading: isLoading } = usePlaygroundUI();

	useEffect(() => {
		fetchAllTestcases();
	}, [fetchAllTestcases, projectParams]);

	const isCheckboxesDisabled =
		selectedValues[0] === "nok" ||
		selectedValues[0] === "need_run" ||
		selectedValues[0] === "passed";

	const columns = useTestcasesColumns({
		prompts,
		selected:
			selectedValues[0] === "selected" ||
			selectedValues[0] === "nok" ||
			selectedValues[0] === "need_run" ||
			selectedValues[0] === "passed",
		runningRows,
		setConfirmModalOpen,
		setSelectedTestcase,
		checkboxesDisabled: isCheckboxesDisabled,
	});

	const testcasesFiltered = useMemo(() => {
		return testcasesFilter(testcases, search, filterState);
	}, [testcases, filterState, search]);

	const table = useReactTable({
		data: testcasesFiltered,
		columns,
		getCoreRowModel: getCoreRowModel(),
		enableRowSelection: true,
		state: {
			sorting,
		},
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
	});

	const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);

	const onChange = (value: UsedOption["value"]) => {
		setSelectedValues([value]);
	};

	useEffect(() => {
		setSearch("");
		setSelectedValues(["all"]);
		setFilterState({
			prompts: [],
			testcasesStatus: [],
		});
		setRunningRows([]);
		setSorting([]);
	}, [projectParams]);

	useEffect(() => {
		if (selectedValues[0] === "nok") {
			table.getRowModel().rows.forEach((row) => {
				if (row.original.status === "NOK") {
					row.toggleSelected(true);
				} else {
					row.toggleSelected(false);
				}
			});
		} else if (selectedValues[0] === "need_run") {
			table.getRowModel().rows.forEach((row) => {
				if (row.original.status === "NEED_RUN") {
					row.toggleSelected(true);
				} else {
					row.toggleSelected(false);
				}
			});
		} else if (selectedValues[0] === "passed") {
			table.getRowModel().rows.forEach((row) => {
				if (row.original.status === "OK") {
					row.toggleSelected(true);
				} else {
					row.toggleSelected(false);
				}
			});
		} else if (selectedValues[0] === "all" || selectedValues[0] === "selected") {
			table.toggleAllRowsSelected(false);
		}
	}, [selectedValues, table, testcasesFiltered]);

	const runTestHandler = async () => {
		let testcasesForRun: any = [];

		if (selectedValues[0] === "all") {
			testcasesForRun = testcasesFiltered;
		} else if (
			selectedValues[0] === "nok" ||
			selectedValues[0] === "selected" ||
			selectedValues[0] === "need_run" ||
			selectedValues[0] === "passed"
		) {
			testcasesForRun = selectedRows;
		}

		if (testcasesForRun?.length > 0) {
			setIsRunning(true);
			const testCaseIds = testcasesForRun.map((item: { id: number }) => item.id);
			setRunningRows(testCaseIds);

			try {
				for (let i = 0; i < testcasesForRun.length; i++) {
					const item = testcasesForRun[i];

					try {
						const updatedTestcase = await testcasesApi.runTestcase(item.id);
						updateSingleTestcase(updatedTestcase);

						setRunningRows((prevState) =>
							prevState.filter((state) => state !== item.id),
						);
					} catch (error) {
						console.error(`Error running test case ${item.id}:`, error);
						setRunningRows((prevState) =>
							prevState.filter((state) => state !== item.id),
						);
					}
				}
			} catch (error) {
				console.error("Failed to run test cases:", error);
				setRunningRows([]);
			} finally {
				setIsRunning(false);
			}
		}
	};

	const confirmationDeleteHandler = async () => {
		if (selectedTestcase) {
			setIsDeleting(true);
			try {
				await testcasesApi.deleteTestcase(selectedTestcase.id);
				await fetchAllTestcases();
				setConfirmModalOpen(false);
				setSelectedTestcase(null);
			} catch (error) {
				console.error("Error deleting testcase:", error);
			} finally {
				setIsDeleting(false);
			}
		}
	};

	const handleRowClick = (row: Row<TestCase>) => {
		navigate(
			addParamsToUrl(
				`/prompt/${row.original.promptId}/playground?testcaseId=${row.original.id}`,
			),
		);
	};

	const getRunTestsButtonLabel = (selectedValue: string) => {
		switch (selectedValue) {
			case "all":
				return "Run All";
			case "nok":
				return "Run All Failed";
			case "need_run":
				return "Run All Need Run";
			case "passed":
				return "Run All Passed";
			case "selected":
				return "Run Selected";
			default:
				return "Run Tests";
		}
	};

	const runTestsButtonLabel = getRunTestsButtonLabel(selectedValues[0] || "");

	const getRowCount = () => {
		if (selectedValues[0] === "all") {
			return table.getRowModel().rows.length;
		} else if (
			selectedValues[0] === "nok" ||
			selectedValues[0] === "need_run" ||
			selectedValues[0] === "selected" ||
			selectedValues[0] === "passed"
		) {
			return table.getSelectedRowModel().rows.length;
		}
		return 0;
	};

	return (
		<>
			<div className="space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full pt-6">
				<div className="flex justify-between">
					<div className="flex items-center gap-3">
						<SearchInput
							placeholder="Search..."
							className="min-w-[241px]"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
						<div className="flex items-center gap-4">
							<TestCasesFilter
								prompts={prompts}
								filterState={filterState}
								setFilterState={setFilterState}
							/>
							{((filterState.testcasesStatus &&
								filterState.testcasesStatus.length > 0) ||
								(filterState.prompts && filterState.prompts.length > 0)) && (
								<ActiveFilterChips
									chips={[
										...filterState.testcasesStatus.map((status) => ({
											key: `${status}`,
											label:
												status === "OK"
													? "Passed"
													: status === "NOK"
														? "Failed"
														: status === "NEED_RUN"
															? "Need run"
															: status,
											onRemove: () =>
												setFilterState((prev) => ({
													...prev,
													testcasesStatus: prev.testcasesStatus.filter(
														(s) => s !== status,
													),
												})),
										})),
										...(prompts && filterState.prompts
											? (filterState.prompts
													.map((promptId) => {
														const prompt = prompts.find(
															(p) => p.id === promptId,
														);
														return prompt
															? {
																	key: `prompt-${promptId}`,
																	label: prompt.name,
																	onRemove: () =>
																		setFilterState((prev) => ({
																			...prev,
																			prompts: prev.prompts
																				? prev.prompts.filter(
																						(id) =>
																							id !==
																							promptId,
																					)
																				: [],
																		})),
																}
															: null;
													})
													.filter(Boolean) as {
													key: string;
													label: string;
													onRemove: () => void;
												}[])
											: []),
									]}
								/>
							)}
						</div>
					</div>
					<ButtonWithDropdown
						label={runTestsButtonLabel}
						runTestHandler={runTestHandler}
						options={usedOptions}
						selectedValues={selectedValues}
						rowLength={getRowCount()}
						onChange={(value) => onChange(value as UsedOptionValue)}
						loading={isRunning || runningRows.length > 0}
					/>
				</div>

				<div className="rounded-md overflow-hidden">
					<Table>
						<TableHeader className="bg-muted text-muted-foreground text-sm font-medium leading-5 h-[54px]">
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow
									key={headerGroup.id}
									className="[&_th:first-child]:text-left [&_th:last-child]:text-right"
								>
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											className={`h-auto py-[16px] px-[14px] whitespace-nowrap ${
												header.column.id === "prompt" ? "text-left" : ""
											}`}
										>
											<div
												className={
													header.column.id === "name" ||
													header.column.id === "prompt"
														? "w-full text-left"
														: "flex items-center justify-center w-full"
												}
											>
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
											</div>
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows.length > 0 ? (
								table.getRowModel().rows.map((row) => (
									<TableRow
										key={row.id}
										className="cursor-pointer [&_td:first-child]:text-left [&_td:last-child]:text-right"
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell
												key={cell.id}
												className={`text-left ${cell.column.id === "prompt" ? "text-left" : ""}`}
												onClick={
													cell.column.id !== "actions" &&
													cell.column.id !== "select"
														? () => handleRowClick(row)
														: undefined
												}
											>
												<div
													className={
														cell.column.id === "name" ||
														cell.column.id === "prompt"
															? "w-full text-left"
															: "flex items-center justify-center w-full"
													}
												>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</div>
											</TableCell>
										))}
									</TableRow>
								))
							) : (
								<TableRow className="transition-none border-0 hover:bg-transparent">
									<TableCell
										colSpan={columns.length}
										className="px-0 border-0 hover:bg-transparent"
									>
										<EmptyState
											title="No results found"
											description="Make your first testcase in Playground"
										/>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
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
