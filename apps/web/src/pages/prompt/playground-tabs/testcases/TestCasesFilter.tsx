import { useState, useEffect, useCallback, useMemo, memo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { ListFilter } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import type { Prompt } from "@/pages/prompt/Prompts";
import type { TestStatus } from "@/types/TestСase";
import { testcaseStatusOptions, truncateText } from "./utils/testcases.utils";

export type FilterState = {
	prompts?: number[];
	testcasesStatus: TestStatus[];
};

type TestCasesFilterProps = {
	prompts?: Prompt[];
	filterState: FilterState;
	setFilterState: Dispatch<SetStateAction<FilterState>>;
};

const TestCasesFilter = ({ prompts, filterState, setFilterState }: TestCasesFilterProps) => {
	const [filtersOpen, setFiltersOpen] = useState(false);

	const [tempFilters, setTempFilters] = useState({ ...filterState });

	useEffect(() => {
		if (filtersOpen) {
			setTempFilters({ ...filterState });
		}
	}, [filtersOpen, filterState]);

	const toggleArrayValue = useCallback(
		(value: number | TestStatus, arrayName: "prompts" | "testcasesStatus") => {
			setTempFilters((prevState) => {
				const currentArray = [...(prevState[arrayName] || [])];
				const nextArray = currentArray.includes(value)
					? currentArray.filter((item) => item !== value)
					: [...currentArray, value];

				return {
					...prevState,
					[arrayName]: nextArray,
				};
			});
		},
		[],
	);

	const resetFilters = useCallback(() => {
		setTempFilters({
			prompts: [],
			testcasesStatus: [],
		});
	}, []);

	const applyFilters = useCallback(() => {
		setFilterState({ ...tempFilters });
		setFiltersOpen(false);
	}, [setFilterState, tempFilters]);

	const selectedPromptIds = useMemo(
		() => new Set<number>(tempFilters.prompts ?? []),
		[tempFilters.prompts],
	);
	return (
		<Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" className="flex items-center gap-2">
					<ListFilter className="w-4 h-4" /> Filters
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[280px] p-4" align="start">
				<div className="flex flex-col gap-2">
					<h3 className="text-base-foreground leading-7 text-sm font-semibold tracking-tight">
						Filters
					</h3>

					<div className="flex flex-col gap-2">
						<span className="text-[#71717A] dark:text-[#a3a3a3] text-xs font-medium leading-none">
							Testcases Status
						</span>
						<div className="grid gap-2">
							{testcaseStatusOptions.map(({ value, label }) => (
								<div key={value} className="flex items-center space-x-2 cursor-pointer">
									<Checkbox
										checked={tempFilters.testcasesStatus.includes(value)}
										onCheckedChange={() =>
											toggleArrayValue(value, "testcasesStatus")
										}
										aria-label={label}
									/>
									<span className="text-sm break-all">{label}</span>
								</div>
							))}
						</div>
					</div>

					{!!prompts && (
						<div className="flex flex-col gap-2">
							<span className="text-[#71717A] dark:text-[#a3a3a3] text-xs font-medium leading-none">
								Prompts
							</span>
							<div className="grid gap-2">
								{prompts.map((item) => (
									<div key={item.id} className="flex items-center space-x-2">
										<Checkbox
											checked={selectedPromptIds.has(item.id)}
											onCheckedChange={() =>
												toggleArrayValue(item.id, "prompts")
											}
											aria-label={item.name}
										/>
										<span className="text-sm break-all" title={item.name}>
											{truncateText(item.name)}
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Action buttons */}
					<div className="flex justify-between">
						<Button variant="outline" onClick={resetFilters} type="button">
							Reset
						</Button>
						<Button onClick={applyFilters} type="button">
							Apply
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
};

export default memo(TestCasesFilter);
