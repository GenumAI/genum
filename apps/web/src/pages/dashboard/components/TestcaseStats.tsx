import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { CheckCircle2, XCircle, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import type { PromptStats } from "@/pages/dashboard/hooks/useTestcasesGroupedByPrompt";
import { useTestcaseStats } from "@/pages/dashboard/hooks/useTestcaseStats";
import {
	truncateChartLabel,
	testcaseBarColors,
	testcaseChartConfig,
} from "@/pages/dashboard/utils/testcaseStats";
import { TweenNumber } from "./TweenNumber";

type HoveredBar = { promptId: number; dataKey: "passed" | "failed" } | null;

interface TooltipPayloadItem {
	dataKey?: string;
}

interface FilteredTooltipProps {
	active?: boolean;
	payload?: TooltipPayloadItem[];
	hoveredBar: HoveredBar;
}

function FilteredChartTooltip({ hoveredBar, ...props }: FilteredTooltipProps) {
	if (hoveredBar) {
		const filteredPayload =
			props.payload?.filter((p) => p.dataKey === hoveredBar.dataKey) ?? [];
		return <ChartTooltipContent {...props} payload={filteredPayload} />;
	}
	if (!props.active || !props.payload?.length) {
		return null;
	}
	return <ChartTooltipContent {...props} />;
}

interface Props {
	prompts: PromptStats[];
	isLoading?: boolean;
}

export function TestcaseStats({ prompts, isLoading: isForcedLoading = false }: Props) {
	const {
		isLoading: isDataLoading,
		chartData,
		dataToShow,
		hasMoreData,
		totalStats,
		errorRate,
		showAll,
		hoveredBar,
		toggleShowAll,
		setHovered,
		clearHovered,
		isHovered,
		navigateToPromptTestcases,
	} = useTestcaseStats(prompts);
	const isLoading = isForcedLoading || isDataLoading;

	if (isLoading) {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3 border bg-card text-card-foreground shadow-sm rounded-lg">
				<Card className="p-0 shadow-none border-none">
					<CardHeader className="flex flex-row justify-between items-center pb-2">
						<Skeleton className="h-6 w-[220px]" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-[230px] w-full rounded-md" />
					</CardContent>
				</Card>
				<Card className="p-0 shadow-none border-none flex flex-col gap-4 justify-start">
					<CardHeader className="pb-0">
						<Skeleton className="h-6 w-[180px]" />
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-3 gap-3">
							<Skeleton className="h-20 w-full rounded-lg" />
							<Skeleton className="h-20 w-full rounded-lg" />
							<Skeleton className="h-20 w-full rounded-lg" />
						</div>
						<Skeleton className="h-24 w-full rounded-lg" />
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-3 border bg-card text-card-foreground shadow-sm rounded-lg">
			<Card className="p-0 shadow-none border-none">
				<CardHeader className="flex flex-row justify-between items-center pb-2">
					<CardTitle className="text-base text-foreground">
						Prompt Executions Statistics
					</CardTitle>
				</CardHeader>
					<CardContent>
						<ChartContainer config={testcaseChartConfig}>
						<BarChart layout="vertical" data={dataToShow}>
							<CartesianGrid
								horizontal={false}
								stroke="hsl(var(--muted-foreground) / 0.2)"
							/>
							<XAxis
								type="number"
								tickLine={false}
								tickMargin={10}
								axisLine={false}
							/>
							<YAxis
								type="category"
								dataKey="name"
								tickLine={false}
								axisLine={false}
								width={chartData.length > 0 ? 150 : 0}
								tick={
									chartData.length > 0
										? ({ y, payload }) => (
												<text
													x={0}
													y={y}
													fill="hsl(var(--foreground))"
													fontSize="12px"
													textAnchor="start"
												>
													<tspan x={0}>
														{truncateChartLabel(payload?.value)}
													</tspan>
												</text>
											)
										: false
								}
							/>

							<ChartTooltip
								cursor={false}
								content={<FilteredChartTooltip hoveredBar={hoveredBar} />}
							/>

							<Bar
								dataKey="passed"
								stackId="a"
								radius={[4, 4, 4, 4]}
								barSize={18}
								name="Passed"
								isAnimationActive
								animationDuration={900}
								animationBegin={120}
								animationEasing="ease-out"
								onMouseEnter={(data) =>
									setHovered(data.prompt_id, "passed")
								}
								onMouseLeave={clearHovered}
								style={{ cursor: "pointer" }}
								fill="hsl(var(--chart-2))"
								onClick={(data) => {
									navigateToPromptTestcases(data.prompt_id, "passed");
								}}
							>
								{dataToShow.map((item) => (
									<Cell
										key={`cell-passed-${item.prompt_id}`}
										fill={
											isHovered(item.prompt_id, "passed")
												? testcaseBarColors.passed.hover
												: testcaseBarColors.passed.base
										}
										style={{ transition: "fill 0.2s ease", cursor: "pointer" }}
									/>
								))}
							</Bar>

							<Bar
								dataKey="failed"
								stackId="a"
								radius={[4, 4, 4, 4]}
								barSize={18}
								name="Failed"
								isAnimationActive
								animationDuration={900}
								animationBegin={220}
								animationEasing="ease-out"
								onMouseEnter={(data) =>
									setHovered(data.prompt_id, "failed")
								}
								onMouseLeave={clearHovered}
								style={{ cursor: "pointer" }}
								fill="hsl(var(--chart-6))"
								onClick={(data) => {
									navigateToPromptTestcases(data.prompt_id, "failed");
								}}
							>
								{dataToShow.map((item) => (
									<Cell
										key={`cell-failed-${item.prompt_id}`}
										fill={
											isHovered(item.prompt_id, "failed")
												? testcaseBarColors.failed.hover
												: testcaseBarColors.failed.base
										}
										style={{ transition: "fill 0.2s ease", cursor: "pointer" }}
									/>
								))}
							</Bar>
						</BarChart>
					</ChartContainer>

					{hasMoreData && (
						<Button
							variant="outline"
							onClick={toggleShowAll}
							className="w-[100px] text-[14px] mt-4 bg-muted hover:bg-muted/80 border-border text-foreground"
						>
							{showAll ? (
								<>
									See less
									<ChevronUp className="ml-1 h-4 w-4" />
								</>
							) : (
								<>
									See all
									<ChevronDown className="ml-1 h-4 w-4" />
								</>
							)}
						</Button>
					)}
				</CardContent>
			</Card>

			<Card className="p-0 shadow-none border-none flex flex-col gap-4 justify-start">
				<CardHeader className="pb-0">
					<CardTitle className="text-base text-foreground">
						Testcases Statistics
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Top 3 stats */}
					<div className="grid grid-cols-3 rounded-lg bg-muted py-[18px] text-left divide-x divide-border">
						<div className="px-6 py-2">
							<div className="text-[16px] leading-[20px] font-medium flex items-center gap-1.5 mb-3 text-foreground">
								Passed{" "}
								<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#2da44a]" />
							</div>
							<div className="text-[24px] leading-[32px] font-bold text-foreground">
								<TweenNumber
									value={totalStats.passed}
									formatValue={(value) => `${Math.round(value)}`}
								/>
							</div>
						</div>
						<div className="px-6 py-2">
							<div className="text-[16px] leading-[20px] font-medium flex items-center gap-1.5 mb-3 text-foreground">
								Failed{" "}
								<XCircle className="w-4 h-4 text-rose-600 dark:text-[#D64646]" />
							</div>
							<div className="text-[24px] leading-[32px] font-bold text-foreground">
								<TweenNumber
									value={totalStats.failed}
									formatValue={(value) => `${Math.round(value)}`}
								/>
							</div>
						</div>
						<div className="px-6 py-2">
							<div className="text-[16px] leading-[20px] font-medium flex items-center gap-1.5 mb-3 text-foreground">
								Need Run{" "}
								<AlertCircle className="w-4 h-4 text-amber-600 dark:text-[#cd9932]" />
							</div>
							<div className="text-[24px] leading-[32px] font-bold text-foreground">
								<TweenNumber
									value={totalStats.needRun}
									formatValue={(value) => `${Math.round(value)}`}
								/>
							</div>
						</div>
					</div>

					{/* Totals & error rate */}
					<div className="flex w-full py-4 border border-border shadow-sm rounded-lg">
						<div className="flex flex-col px-6 gap-[42px] text-left border-r border-border flex-1">
							<div className="text-[16px] font-medium leading-[20px] text-foreground">
								Total Testcases
							</div>
							<div className="text-[30px] font-semibold leading-[22px] text-foreground">
								<TweenNumber
									value={totalStats.total}
									formatValue={(value) => `${Math.round(value)}`}
								/>
							</div>
						</div>
						<div className="flex flex-col px-6 gap-[42px] text-left flex-1">
							<div className="text-[16px] font-medium leading-[20px] text-foreground">
								Error Rate
							</div>
							<div className="text-[30px] font-semibold leading-[22px] text-foreground">
								<TweenNumber
									value={errorRate}
									formatValue={(value) => `${Number(value.toFixed(2))}%`}
								/>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
