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
import { testcasesApi } from "@/api/testcases/testcases.api";
import TestCasesFilter from "@/pages/prompt/playground-tabs/testcases/TestCasesFilter";
import { testcasesFilter } from "@/lib/testcasesFilter";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import DeleteConfirmDialog from "@/components/dialogs/DeleteConfirmDialog";
import type { TestCase, TestStatus } from "@/types/TestСase";
import { SearchInput } from "@/components/ui/searchInput";
import { useQueryClient } from "@tanstack/react-query";
import { usePromptTestcases } from "@/hooks/usePromptTestcases";

import ActiveFilterChips from "./ActiveFilterChips";
import { useAddParamsToUrl } from "@/lib/addParamsToUrl";
import ButtonWithDropdown from "@/components/ui/buttonWithDropdown";
import { EmptyState } from "@/pages/info-pages/EmptyState";

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
	testcasesStatus: TestStatus[];
};

export default function Testcases() {
	const { id } = useParams<{ id: string; orgId: string; projectId: string }>();
	const [searchParams] = useSearchParams();
	const currentTestcaseId = searchParams.get("testcaseId");

	const [search, setSearch] = useState("");
	const [selectedValues, setSelectedValues] = useState<UsedOptionValue[]>(["all"]);

	const getInitialStatus = (): TestStatus[] => {
		const status = searchParams.get("status");
		if (status === "passed") return ["OK"];
		if (status === "failed") return ["NOK"];
		return [];
	};

	const [filterState, setFilterState] = useState<FilterState>({
		testcasesStatus: getInitialStatus(),
	});
	const [runningRows, setRunningRows] = useState<number[]>([]);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [selectedTestcase, setSelectedTestcase] = useState<TestCase | null>(null);
	const [isRunning, setIsRunning] = useState(false);

	const [sorting, setSorting] = useState<SortingState>([]);

	const navigate = useNavigate();
	const addParamsToUrl = useAddParamsToUrl();
	const queryClient = useQueryClient();
	const promptId = id ? Number(id) : undefined;
	const { data: testcases = [], refetch } = usePromptTestcases(promptId);

	const handleRefetch = async () => {
		await refetch();
	};

	const isCheckboxesDisabled =
		selectedValues[0] === "nok" ||
		selectedValues[0] === "need_run" ||
		selectedValues[0] === "passed";

	const columns = useTestcasesColumns({
		selected:
			selectedValues[0] === "selected" ||
			selectedValues[0] === "nok" ||
			selectedValues[0] === "need_run" ||
			selectedValues[0] === "passed",
		runningRows,
		setConfirmModalOpen,
		setSelectedTestcase,
		checkboxesDisabled: isCheckboxesDisabled,
		hidePromptColumn: true,
		currentTestcaseId: currentTestcaseId ? Number(currentTestcaseId) : undefined,
	});

	const testcasesFiltered = useMemo(() => {
		const filtered = testcasesFilter(testcases, search, filterState);

		if (currentTestcaseId) {
			const currentTestcase = filtered.find((tc) => tc.id === Number(currentTestcaseId));
			if (currentTestcase) {
				const otherTestcases = filtered.filter((tc) => tc.id !== Number(currentTestcaseId));
				return [currentTestcase, ...otherTestcases];
			}
		}

		return filtered;
	}, [testcases, filterState, search, currentTestcaseId]);

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

	const [isDeleting, setIsDeleting] = useState(false);

	const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);

	const onChange = (value: UsedOption["value"]) => {
		setSelectedValues([value]);
	};

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
						await testcasesApi.runTestcase(item.id);

						// Force refetch to get fresh data and trigger re-render
						await refetch();

						// Also update status counts cache
						if (promptId) {
							await queryClient.invalidateQueries({
								queryKey: ["testcase-status-counts", promptId],
							});
						}

						setRunningRows((prevState) =>
							prevState.filter((state) => Number(state) !== Number(item.id)),
						);
					} catch (error) {
						console.error(`Error running test case ${item.id}:`, error);
						setRunningRows((prevState) =>
							prevState.filter((state) => Number(state) !== Number(item.id)),
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
				await handleRefetch();
				queryClient.invalidateQueries({ queryKey: ["testcase-status-counts", promptId] });
				queryClient.invalidateQueries({ queryKey: ["prompt-testcases", promptId] });
				setConfirmModalOpen(false);
				setSelectedTestcase(null);
			} catch (error) {
				console.error("Failed to delete testcase:", error);
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
			<div className="space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full pt-8">
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
								filterState={filterState}
								setFilterState={setFilterState}
							/>
							{filterState.testcasesStatus.length > 0 && (
								<ActiveFilterChips
									chips={filterState.testcasesStatus.map((status) => ({
										key: status,
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
									}))}
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
						onChange={(value: string) => onChange(value as UsedOptionValue)}
						loading={isRunning || runningRows.length > 0}
					/>
				</div>

				<div className="rounded-md overflow-hidden">
					<Table>
						<TableHeader className="bg-[#F4F4F5] text-[#71717A] dark:bg-[#262626] dark:text-[#fff] text-sm font-medium leading-5 h-[54px]">
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow
									key={headerGroup.id}
									className="[&_th:first-child]:text-left [&_th:last-child]:text-right"
								>
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											className="h-auto py-[16px] px-[14px]"
										>
											<div
												className={
													header.column.id === "name"
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
												className="text-left"
												onClick={
													cell.column.id !== "actions" &&
													cell.column.id !== "select"
														? () => handleRowClick(row)
														: undefined
												}
											>
												<div
													className={
														cell.column.id === "name"
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
