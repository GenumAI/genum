import { useState, useEffect, useMemo } from "react";
import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
} from "@tanstack/react-table";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import useTestcasesColumns from "@/hooks/useTestcasesColumns";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { testcasesFilter } from "@/lib/testcasesFilter";
import { usePromptTestcases } from "@/hooks/usePromptTestcases";
import { useAddParamsToUrl } from "@/lib/addParamsToUrl";
import type { TestCase } from "@/types/TestСase";
import type { FilterState } from "../Testcases";
import { getInitialStatus } from "../utils/testcases.utils";

export type UsedOptionValue = "all" | "nok" | "selected" | "need_run" | "passed";

export const useTestcasesTable = (promptId?: number) => {
	const [searchParams] = useSearchParams();
	const currentTestcaseId = searchParams.get("testcaseId");
	const navigate = useNavigate();
	const addParamsToUrl = useAddParamsToUrl();
	const queryClient = useQueryClient();

	const [search, setSearch] = useState("");
	const [selectedValues, setSelectedValues] = useState<UsedOptionValue[]>(["all"]);
	const [filterState, setFilterState] = useState<FilterState>({
		testcasesStatus: getInitialStatus(searchParams),
	});
	const [runningRows, setRunningRows] = useState<number[]>([]);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [selectedTestcase, setSelectedTestcase] = useState<TestCase | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [sorting, setSorting] = useState<SortingState>([]);

	const { data: testcases = [] } = usePromptTestcases(promptId);

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

	const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);

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
	}, [selectedValues, table]);


	const runTestHandler = async () => {
		let testcasesForRun: TestCase[] = [];

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
			const testCaseIds = testcasesForRun.map((item) => item.id);
			setRunningRows(testCaseIds);

			try {
				for (let i = 0; i < testcasesForRun.length; i++) {
					const item = testcasesForRun[i];

					try {
						const response = await testcasesApi.runTestcase(item.id);
						const updatedTestcase = response.testcase;
						
						queryClient.setQueryData<TestCase[]>(
							["prompt-testcases", promptId],
							(oldData) => {
								if (!oldData) return oldData;
								return oldData.map((tc) =>
									tc.id === updatedTestcase.id ? updatedTestcase : tc,
								);
							},
						);

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
				if (promptId) {
					queryClient.invalidateQueries({
						queryKey: ["testcase-status-counts", promptId],
					});
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
				
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: ["testcase-status-counts", promptId] }),
					queryClient.invalidateQueries({ queryKey: ["prompt-testcases", promptId] }),
				]);
				
				setConfirmModalOpen(false);
				setSelectedTestcase(null);
			} catch (error) {
				console.error("Failed to delete testcase:", error);
			} finally {
				setIsDeleting(false);
			}
		}
	};

	const handleRowClick = (testcase: TestCase) => {
		navigate(
			addParamsToUrl(`/prompt/${testcase.promptId}/playground?testcaseId=${testcase.id}`),
		);
	};

	const handleFilterChange = (value: UsedOptionValue) => {
		setSelectedValues([value]);
	};

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

	return {
		search,
		setSearch,
		selectedValues,
		filterState,
		setFilterState,
		runningRows,
		confirmModalOpen,
		setConfirmModalOpen,
		selectedTestcase,
		isRunning,
		isDeleting,

		table,
		columns,

		runTestHandler,
		confirmationDeleteHandler,
		handleRowClick,
		handleFilterChange,

		getRowCount,
	};
};
