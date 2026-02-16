import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateRangePopoverField } from "@/components/popovers/DateRangePopoverField";
import { ListFilter } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	type RangeTab,
	getDatePresets,
	getTabByRange,
	isPresetTab,
} from "../utils/logsFilterUtils";

export interface LogsFilterState {
	dateRange?: DateRange;
	logLevel?: string;
	model?: string;
	source?: string;
	promptId?: number;
	query?: string;
}

interface LogsFilterProps {
	filter: LogsFilterState;
	setFilter: (f: LogsFilterState) => void;
	promptNames: { id: number; name: string }[];
	showFiltersButton?: boolean;
	showQueryField?: boolean;
	queryInput?: string;
	onQueryChange?: (value: string) => void;
}

export function LogsFilter({
	filter,
	setFilter,
	promptNames,
	showFiltersButton = true,
	showQueryField = false,
	queryInput,
	onQueryChange,
}: LogsFilterProps) {
	const today = useMemo(() => new Date(), []);
	const presets = useMemo(() => getDatePresets(today), [today]);

	const getTabByRangeForFilter = useCallback(
		(range?: DateRange): RangeTab => {
			return getTabByRange(range, presets);
		},
		[presets],
	);

	const [tab, setTab] = useState<RangeTab>(() => getTabByRangeForFilter(filter.dateRange));
	const [customDate, setCustomDate] = useState<DateRange | undefined>(filter.dateRange);
	const dateRangeRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const detectedTab = getTabByRangeForFilter(filter.dateRange);
		setTab(detectedTab);
		if (detectedTab === "custom") {
			setCustomDate(filter.dateRange);
		}
	}, [filter.dateRange, getTabByRangeForFilter]);

	const updateFilter = useCallback(
		(patch: Partial<LogsFilterState>) => {
			setFilter({
				...filter,
				...patch,
			});
		},
		[filter, setFilter],
	);

	const handleCustomApply = useCallback(
		(range: DateRange | undefined) => {
			updateFilter({
				dateRange: range,
			});
			const detectedTab = getTabByRangeForFilter(range);
			setTab(detectedTab);
			if (detectedTab === "custom") setCustomDate(range);
		},
		[getTabByRangeForFilter, updateFilter],
	);

	const handleTabChange = useCallback(
		(value: string) => {
			if (value === "custom") {
				setTab("custom");
				if (customDate?.from && customDate?.to) {
					updateFilter({
						dateRange: customDate,
					});
				}
				dateRangeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
				return;
			}

			if (!isPresetTab(value)) return;
			setTab(value);
			updateFilter({
				dateRange: presets[value],
			});
		},
		[customDate, presets, updateFilter],
	);

	const handleQueryInputChange = useCallback(
		(value: string) => {
			if (onQueryChange) {
				onQueryChange(value);
				return;
			}

			updateFilter({
				query: value,
			});
		},
		[onQueryChange, updateFilter],
	);

	const handleLogLevelChange = useCallback(
		(value: string) => {
			updateFilter({
				logLevel: value === "all" ? undefined : value,
			});
		},
		[updateFilter],
	);

	const handleSourceChange = useCallback(
		(value: string) => {
			updateFilter({
				source: value === "all" ? undefined : value,
			});
		},
		[updateFilter],
	);

	const handlePromptChange = useCallback(
		(value: string) => {
			updateFilter({
				promptId: value === "all" ? undefined : Number(value),
			});
		},
		[updateFilter],
	);

	const handleReset = useCallback(() => {
		updateFilter({
			logLevel: undefined,
			model: undefined,
			source: undefined,
			promptId: undefined,
			query: showQueryField ? undefined : filter.query,
		});
		if (showQueryField && onQueryChange) {
			onQueryChange("");
		}
	}, [filter.query, onQueryChange, showQueryField, updateFilter]);

	const queryValue = queryInput !== undefined ? queryInput : filter.query || "";

	const promptValue = filter.promptId ? String(filter.promptId) : "all";
	const logLevelValue = filter.logLevel || "all";
	const sourceValue = filter.source || "all";

	const hasPrompts = promptNames.length > 0;

	const promptOptions = useMemo(() => {
		return promptNames.map((prompt) => (
			<SelectItem key={prompt.id} value={String(prompt.id)}>
				{prompt.name}
			</SelectItem>
		));
	}, [promptNames]);

	return (
		<div className="flex items-end gap-4">
			<div className="flex flex-row items-center gap-2 flex-1">
				<div ref={dateRangeRef}>
					<DateRangePopoverField value={filter.dateRange} onApply={handleCustomApply} />
				</div>

				<Tabs value={tab} onValueChange={handleTabChange} className="w-fit">
					<TabsList>
						<TabsTrigger value="day">Past 1 day</TabsTrigger>
						<TabsTrigger value="week">Past 1 week</TabsTrigger>
						<TabsTrigger value="month">Past 1 month</TabsTrigger>
						<TabsTrigger value="custom">Custom range</TabsTrigger>
					</TabsList>
				</Tabs>

				<div className="flex-1" />

				{showQueryField && (
					<Input
						placeholder="Search logs..."
						value={queryValue}
						onChange={(e) => handleQueryInputChange(e.target.value)}
						className="w-[200px]"
					/>
				)}

				{showFiltersButton && (
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline" size="icon">
								<ListFilter className="w-4 h-4" />
							</Button>
						</PopoverTrigger>

						<PopoverContent
							align="start"
							className="w-[320px] p-4 bg-popover text-popover-foreground border border-border shadow-md rounded-md"
						>
							<div className="flex flex-col gap-2">
								<h3 className="leading-7 text-sm font-semibold tracking-tight mb-1 text-foreground">
									Filters
								</h3>

								<div>
									<p className="block text-sm font-medium mb-1 text-muted-foreground">
										Log Level
									</p>
									<Select
										value={logLevelValue}
										onValueChange={handleLogLevelChange}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Log Level" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All levels</SelectItem>
											<SelectItem value="SUCCESS">Success</SelectItem>
											<SelectItem value="ERROR">Error</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<Separator className="my-2" />

								<div>
									<p className="block text-sm font-medium mb-1 text-muted-foreground">
										Source
									</p>
									<Select
										value={sourceValue}
										onValueChange={handleSourceChange}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Choose a Source" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All sources</SelectItem>
											<SelectItem value="api">API</SelectItem>
											<SelectItem value="ui">UI</SelectItem>
											<SelectItem value="testcase">Testcase</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{hasPrompts && (
									<>
										<Separator className="my-2" />
										<div>
											<p className="block text-sm font-medium mb-1 text-muted-foreground">
												Prompt
											</p>
											<Select
												value={promptValue}
												onValueChange={handlePromptChange}
											>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Choose a prompt" />
												</SelectTrigger>
												<SelectContent className="max-h-[200px]">
													<SelectItem value="all">All prompts</SelectItem>
													{promptOptions}
												</SelectContent>
											</Select>
										</div>
									</>
								)}

								<Button
									variant="secondary"
									className="w-full mt-2"
									onClick={handleReset}
								>
									Reset
								</Button>
							</div>
						</PopoverContent>
					</Popover>
				)}
			</div>
		</div>
	);
}
