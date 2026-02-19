import { useState, useEffect, useMemo, useCallback } from "react";
import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
} from "@tanstack/react-table";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useTestcasesColumns from "@/hooks/useTestcasesColumns";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { testcasesFilter } from "@/lib/testcasesFilter";
import { usePromptTestcases } from "@/hooks/usePromptTestcases";
import { useAddParamsToUrl } from "@/lib/addParamsToUrl";
import type { TestCase } from "@/types/TestСase";
import type { Prompt } from "@/pages/prompt/utils/types";
import type { FilterState } from "../TestCasesFilter";
import {
	getAutoSelectStatus,
	getInitialStatus,
	isCheckboxesDisabledForFilter,
	isSelectionBasedFilter,
	type UsedOptionValue,
} from "../utils/testcases.utils";
import { useRefetchOnWorkspaceChange } from "@/hooks/useRefetchOnWorkspaceChange";

type UseTestcasesTableOptions = {
	promptId?: number;
	prompts?: Prompt[];
	hidePromptColumn?: boolean;
	resetOnWorkspaceChange?: boolean;
	initialFilterState?: FilterState;
};

const createDefaultFilterState = (): FilterState => ({ prompts: [], testcasesStatus: [] });

export const useTestcasesTable = ({
	promptId,
	prompts,
	hidePromptColumn,
	resetOnWorkspaceChange = false,
	initialFilterState,
}: UseTestcasesTableOptions = {}) => {
	const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
	const [searchParams] = useSearchParams();
	const currentTestcaseId = searchParams.get("testcaseId");
	const navigate = useNavigate();
	const addParamsToUrl = useAddParamsToUrl();
	const queryClient = useQueryClient();

	const [search, setSearch] = useState("");
	const [selectedValues, setSelectedValues] = useState<UsedOptionValue[]>(["all"]);
	const [filterState, setFilterState] = useState<FilterState>(() => {
		if (initialFilterState) return initialFilterState;
		if (promptId) {
			return {
				prompts: [],
				testcasesStatus: getInitialStatus(searchParams),
			};
		}
		return createDefaultFilterState();
	});
	const [runningRows, setRunningRows] = useState<number[]>([]);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [selectedTestcase, setSelectedTestcase] = useState<TestCase | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [sorting, setSorting] = useState<SortingState>([]);

	const {
		data: promptTestcases = [],
		isLoading: isPromptLoading,
		refetch: refetchPromptTestcases,
	} = usePromptTestcases(promptId);
	const {
		data: projectTestcases = [],
		isLoading: isProjectLoading,
		refetch: refetchProjectTestcases,
	} = useQuery({
		queryKey: ["testcases-list", orgId, projectId],
		queryFn: async () => {
			const response = await testcasesApi.getTestcases();
			return response.testcases || [];
		},
		enabled: !promptId && !!orgId && !!projectId,
		refetchOnMount: "always",
	});

	const testcases = promptId ? promptTestcases : projectTestcases;
	const isLoading = promptId ? isPromptLoading : isProjectLoading;

	const selectedValue = selectedValues[0];
	const isCheckboxesDisabled = isCheckboxesDisabledForFilter(selectedValue);

	const columns = useTestcasesColumns({
		prompts,
		selected:
			selectedValue === "selected" ||
			selectedValue === "nok" ||
			selectedValue === "need_run" ||
			selectedValue === "passed",
		runningRows,
		setConfirmModalOpen,
		setSelectedTestcase,
		checkboxesDisabled: isCheckboxesDisabled,
		hidePromptColumn: hidePromptColumn ?? !!promptId,
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
		getRowId: (row) => String(row.id),
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
		const statusForAutoSelect = getAutoSelectStatus(selectedValue);
		if (!statusForAutoSelect) {
			table.toggleAllRowsSelected(false);
			return;
		}

		table.getRowModel().rows.forEach((row) => {
			row.toggleSelected(row.original.status === statusForAutoSelect);
		});
	}, [selectedValue, table]);

	const resetTableState = useCallback(() => {
		setSearch("");
		setSelectedValues(["all"]);
		setFilterState(initialFilterState ?? createDefaultFilterState());
		setRunningRows([]);
		setSorting([]);
	}, [initialFilterState]);

	const refetchActiveSource = useCallback(async () => {
		if (promptId) {
			await refetchPromptTestcases();
			return;
		}
		await refetchProjectTestcases();
	}, [promptId, refetchPromptTestcases, refetchProjectTestcases]);

	useRefetchOnWorkspaceChange(
		async () => {
			resetTableState();
			await refetchActiveSource();
		},
		{ skip: !resetOnWorkspaceChange },
	);

	const runTestHandler = async () => {
		let testcasesForRun: TestCase[] = [];

		if (selectedValue === "all") {
			testcasesForRun = testcasesFiltered;
		} else if (isSelectionBasedFilter(selectedValue)) {
			testcasesForRun = selectedRows;
		}

		if (testcasesForRun?.length > 0) {
			setIsRunning(true);
			const testCaseIds = testcasesForRun.map((item) => item.id);
			setRunningRows(testCaseIds);
			const affectedPromptIds = new Set<number>();

			try {
				for (let i = 0; i < testcasesForRun.length; i++) {
					const item = testcasesForRun[i];

					try {
						const response = await testcasesApi.runTestcase(item.id);
						const updatedTestcase = response.testcase;
						affectedPromptIds.add(updatedTestcase.promptId);

						if (promptId) {
							queryClient.setQueryData<TestCase[]>(
								["prompt-testcases", promptId],
								(oldData) => {
									if (!oldData) return oldData;
									return oldData.map((tc) =>
										tc.id === updatedTestcase.id ? updatedTestcase : tc,
									);
								},
							);
						} else {
							queryClient.setQueryData<TestCase[]>(
								["testcases-list", orgId, projectId],
								(oldData) => {
									if (!oldData) return oldData;
									return oldData.map((tc) =>
										tc.id === updatedTestcase.id ? updatedTestcase : tc,
									);
								},
							);
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
				await Promise.all(
					[...affectedPromptIds].map((affectedPromptId) =>
						queryClient.invalidateQueries({
							queryKey: ["testcase-status-counts", affectedPromptId],
						}),
					),
				);
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

				if (promptId) {
					queryClient.setQueryData<TestCase[]>(
						["prompt-testcases", promptId],
						(oldData) => {
							if (!oldData) return oldData;
							return oldData.filter((tc) => tc.id !== selectedTestcase.id);
						},
					);
				} else {
					queryClient.setQueryData<TestCase[]>(
						["testcases-list", orgId, projectId],
						(oldData) => {
							if (!oldData) return oldData;
							return oldData.filter((tc) => tc.id !== selectedTestcase.id);
						},
					);
				}

				await queryClient.invalidateQueries({
					queryKey: ["testcase-status-counts", selectedTestcase.promptId],
				});

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
		if (selectedValue === "all") {
			return table.getRowModel().rows.length;
		}
		if (isSelectionBasedFilter(selectedValue)) {
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
		isLoading,

		table,
		columns,

		runTestHandler,
		confirmationDeleteHandler,
		handleRowClick,
		handleFilterChange,

		getRowCount,
	};
};
