import type { TestStatus } from "@/types/TestСase";

export type UsedOptionValue = "all" | "nok" | "selected" | "need_run" | "passed";

export type UsedOption = {
	label: string;
	value: UsedOptionValue;
};

export const usedOptions: UsedOption[] = [
	{ label: "All", value: "all" },
	{ label: "Need Run", value: "need_run" },
	{ label: "Passed", value: "passed" },
	{ label: "Failed", value: "nok" },
	{ label: "Selected", value: "selected" },
];

export const testcaseStatusOptions: { value: TestStatus; label: string }[] = [
	{ value: "OK", label: "Passed" },
	{ value: "NOK", label: "Failed" },
	{ value: "NEED_RUN", label: "Need run" },
];

const RUN_TESTS_LABELS: Record<UsedOptionValue, string> = {
	all: "Run All",
	nok: "Run All Failed",
	need_run: "Run All Need Run",
	passed: "Run All Passed",
	selected: "Run Selected",
};

const STATUS_CHIP_LABELS: Record<TestStatus, string> = {
	OK: "Passed",
	NOK: "Failed",
	NEED_RUN: "Need run",
};

const AUTO_SELECT_STATUS_BY_OPTION: Partial<Record<UsedOptionValue, TestStatus>> = {
	nok: "NOK",
	need_run: "NEED_RUN",
	passed: "OK",
};

export const truncateText = (text: string, maxLength = 18): string =>
	text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;

export const getInitialStatus = (searchParams: URLSearchParams): TestStatus[] => {
	const status = searchParams.get("status");
	if (status === "passed") return ["OK"];
	if (status === "failed") return ["NOK"];
	return [];
};

export const getRunTestsButtonLabel = (selectedValue: string): string => {
	return RUN_TESTS_LABELS[selectedValue as UsedOptionValue] ?? "Run Tests";
};

export const getStatusChipLabel = (status: TestStatus): string => {
	return STATUS_CHIP_LABELS[status] ?? status;
};

export const getAutoSelectStatus = (selectedValue: UsedOptionValue): TestStatus | null =>
	AUTO_SELECT_STATUS_BY_OPTION[selectedValue] ?? null;

export const isSelectionBasedFilter = (selectedValue: UsedOptionValue): boolean =>
	selectedValue !== "all";

export const isCheckboxesDisabledForFilter = (selectedValue: UsedOptionValue): boolean =>
	selectedValue === "nok" || selectedValue === "need_run" || selectedValue === "passed";
