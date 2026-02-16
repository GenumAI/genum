import React, { useState, useRef } from "react";
import { DateRange } from "react-day-picker";
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
import { addDays, isSameDay } from "date-fns";

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
	const [tab, setTab] = useState<"day" | "week" | "month" | "custom">("month");
	const [customDate, setCustomDate] = useState<DateRange | undefined>(filter.dateRange);
	const dateRangeRef = useRef<HTMLDivElement>(null);

	const today = new Date();
	const presets = {
		day: { from: addDays(today, -1), to: today },
		week: { from: addDays(today, -7), to: today },
		month: { from: addDays(today, -30), to: today },
	};

	function getTabByRange(range?: DateRange): "day" | "week" | "month" | "custom" {
		if (!range?.from || !range?.to) return "custom";
		if (isSameDay(range.from, presets.day.from) && isSameDay(range.to, presets.day.to))
			return "day";
		if (isSameDay(range.from, presets.week.from) && isSameDay(range.to, presets.week.to))
			return "week";
		if (isSameDay(range.from, presets.month.from) && isSameDay(range.to, presets.month.to))
			return "month";
		return "custom";
	}

	const handleCustomApply = (range: DateRange | undefined) => {
		setFilter({ ...filter, dateRange: range });
		const detectedTab = getTabByRange(range);
		setTab(detectedTab);
		if (detectedTab === "custom") setCustomDate(range);
	};

	const handleTabChange = (value: string) => {
		setTab(value as any);
		if (value === "custom") {
			if (customDate?.from && customDate?.to) {
				setFilter({ ...filter, dateRange: customDate });
			}
			dateRangeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
		} else {
			setFilter({ ...filter, dateRange: presets[value as keyof typeof presets] });
		}
	};

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
						value={queryInput !== undefined ? queryInput : filter.query || ""}
						onChange={(e) => {
							if (onQueryChange) {
								onQueryChange(e.target.value);
							} else {
								setFilter({ ...filter, query: e.target.value });
							}
						}}
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
									<label className="block text-sm font-medium mb-1 text-muted-foreground">
										Log Level
									</label>
									<Select
										value={filter.logLevel || "all"}
										onValueChange={(value) =>
											setFilter({
												...filter,
												logLevel: value === "all" ? undefined : value,
											})
										}
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
									<label className="block text-sm font-medium mb-1 text-muted-foreground">
										Source
									</label>
									<Select
										value={filter.source || "all"}
										onValueChange={(value) =>
											setFilter({
												...filter,
												source: value === "all" ? undefined : value,
											})
										}
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

								{promptNames.length > 0 && (
									<>
										<Separator className="my-2" />
										<div>
											<label className="block text-sm font-medium mb-1 text-muted-foreground">
												Prompt
											</label>
											<Select
												value={
													filter.promptId
														? String(filter.promptId)
														: "all"
												}
												onValueChange={(value) =>
													setFilter({
														...filter,
														promptId:
															value === "all"
																? undefined
																: Number(value),
													})
												}
											>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Choose a prompt" />
												</SelectTrigger>
												<SelectContent className="max-h-[200px]">
													<SelectItem value="all">All prompts</SelectItem>
													{promptNames.map((prompt) => (
														<SelectItem
															key={prompt.id}
															value={String(prompt.id)}
														>
															{prompt.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</>
								)}

								<Button
									variant="secondary"
									className="w-full mt-2"
									onClick={() => {
										setFilter({
											...filter,
											logLevel: undefined,
											model: undefined,
											source: undefined,
											promptId: undefined,
											query: showQueryField ? undefined : filter.query,
										});
										if (showQueryField && onQueryChange) {
											onQueryChange("");
										}
									}}
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
