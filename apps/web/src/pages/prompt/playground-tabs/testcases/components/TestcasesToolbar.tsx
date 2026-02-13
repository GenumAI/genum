import type { Dispatch, SetStateAction } from "react";
import { SearchInput } from "@/components/ui/searchInput";
import ButtonWithDropdown from "@/components/ui/buttonWithDropdown";
import TestCasesFilter from "../TestCasesFilter";
import ActiveFilterChips from "../ActiveFilterChips";
import type { FilterState } from "../Testcases";
import type { UsedOptionValue } from "../hooks/useTestcasesTable";
import { getRunTestsButtonLabel, getStatusChipLabel } from "../utils/testcases.utils";

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

type TestcasesToolbarProps = {
	search: string;
	onSearchChange: (value: string) => void;
	filterState: FilterState;
	onFilterStateChange: Dispatch<SetStateAction<FilterState>>;
	selectedValues: UsedOptionValue[];
	onFilterChange: (value: UsedOptionValue) => void;
	onRunTests: () => void;
	rowCount: number;
	isRunning: boolean;
	runningRowsCount: number;
};

export default function TestcasesToolbar({
	search,
	onSearchChange,
	filterState,
	onFilterStateChange,
	selectedValues,
	onFilterChange,
	onRunTests,
	rowCount,
	isRunning,
	runningRowsCount,
}: TestcasesToolbarProps) {
	const runTestsButtonLabel = getRunTestsButtonLabel(selectedValues[0] || "");

	return (
		<div className="flex justify-between">
			<div className="flex items-center gap-3">
				<SearchInput
					placeholder="Search..."
					className="min-w-[241px]"
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
				/>
				<div className="flex items-center gap-4">
					<TestCasesFilter filterState={filterState} setFilterState={onFilterStateChange} />
					{filterState.testcasesStatus.length > 0 && (
						<ActiveFilterChips
							chips={filterState.testcasesStatus.map((status) => ({
								key: status,
								label: getStatusChipLabel(status),
								onRemove: () =>
									onFilterStateChange({
										...filterState,
										testcasesStatus: filterState.testcasesStatus.filter((s) => s !== status),
									}),
							}))}
						/>
					)}
				</div>
			</div>
			<ButtonWithDropdown
				label={runTestsButtonLabel}
				runTestHandler={onRunTests}
				options={usedOptions}
				selectedValues={selectedValues}
				rowLength={rowCount}
				onChange={(value: string) => onFilterChange(value as UsedOptionValue)}
				loading={isRunning || runningRowsCount > 0}
			/>
		</div>
	);
}
