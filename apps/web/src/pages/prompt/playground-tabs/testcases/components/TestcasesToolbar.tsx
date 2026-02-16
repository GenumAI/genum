import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { SearchInput } from "@/components/ui/searchInput";
import ButtonWithDropdown from "@/components/ui/buttonWithDropdown";
import TestCasesFilter from "../TestCasesFilter";
import ActiveFilterChips from "../ActiveFilterChips";
import type { FilterState } from "../TestCasesFilter";
import type { UsedOptionValue } from "../utils/testcases.utils";
import {
	getRunTestsButtonLabel,
	getStatusChipLabel,
	usedOptions,
} from "../utils/testcases.utils";
import type { Prompt } from "@/pages/prompt/Prompts";

type TestcasesToolbarProps = {
	search: string;
	onSearchChange: (value: string) => void;
	prompts?: Prompt[];
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
	prompts,
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
	const promptNameById = useMemo(
		() => new Map((prompts || []).map((prompt) => [prompt.id, prompt.name])),
		[prompts],
	);
	const chips = useMemo(
		() => [
			...filterState.testcasesStatus.map((status) => ({
				key: status,
				label: getStatusChipLabel(status),
				onRemove: () =>
					onFilterStateChange((prev) => ({
						...prev,
						testcasesStatus: prev.testcasesStatus.filter((s) => s !== status),
					})),
			})),
			...(filterState.prompts || [])
				.map((promptId) => {
					const promptName = promptNameById.get(promptId);
					if (!promptName) return null;
					return {
						key: `prompt-${promptId}`,
						label: promptName,
						onRemove: () =>
							onFilterStateChange((prev) => ({
								...prev,
								prompts: (prev.prompts || []).filter((id) => id !== promptId),
							})),
					};
				})
				.filter(Boolean) as { key: string; label: string; onRemove: () => void }[],
		],
		[filterState.prompts, filterState.testcasesStatus, onFilterStateChange, promptNameById],
	);
	const hasActiveFilters = chips.length > 0;

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
					<TestCasesFilter
						prompts={prompts}
						filterState={filterState}
						setFilterState={onFilterStateChange}
					/>
					{hasActiveFilters && <ActiveFilterChips chips={chips} />}
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
