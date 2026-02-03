import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import {
	ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { CheckCircle2, XCircle, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useTestcasesGroupedByPrompt from "@/hooks/useTestcasesGroupedByPrompt";
import { getOrgId, getProjectId } from "@/api/client";

const chartConfig = {
	passed: { label: "Passed", color: "hsl(var(--chart-2))" },
	failed: { label: "Failed", color: "hsl(var(--chart-6))" },
	label: { color: "hsl(var(--foreground))" },
} satisfies ChartConfig;

const BAR_COLORS = {
	passed: { base: "hsl(var(--chart-2) / 0.75)", hover: "hsl(var(--chart-2))" },
	failed: { base: "hsl(var(--chart-6) / 0.75)", hover: "hsl(var(--chart-6))" },
};

interface PromptStats {
	prompt_id: number;
	total_requests: number;
	total_tokens_in: number;
	total_tokens_out: number;
	average_response_ms: number;
	total_cost: number;
	error_rate: number;
	last_used: string;
}

interface Props {
	prompts: PromptStats[];
}

export function TestcaseStats({ prompts }: Props) {
	const [showAll, setShowAll] = useState(false);
	const [hoveredBar, setHoveredBar] = useState<{ index: number; dataKey: string } | null>(null);
	const navigate = useNavigate();
	const orgId = getOrgId();
	const projectId = getProjectId();

	const { chartData, isLoading, error } = useTestcasesGroupedByPrompt(prompts);

	const dataToShow = showAll ? chartData : chartData.slice(0, 5);
	const hasMoreData = chartData.length > 5;

	const totalStats = useMemo(() => {
		if (!chartData.length) return { total: 0, passed: 0, failed: 0, needRun: 0 };
		return chartData.reduce(
			(
				acc: { total: number; passed: number; failed: number; needRun: number },
				item: any,
			) => ({
				total: acc.total + item.passed + item.failed,
				passed: acc.passed + item.passed,
				failed: acc.failed + item.failed,
				needRun: acc.needRun + item.needRun,
			}),
			{ total: 0, passed: 0, failed: 0, needRun: 0 },
		);
	}, [chartData]);

	const errorRate = useMemo(() => {
		if (totalStats.total === 0) return 0;
		return Math.round((totalStats.failed / totalStats.total) * 100);
	}, [totalStats]);

	const truncateText = (text: unknown, maxLength: number = 20): string => {
		const str = typeof text === "string" ? text : String(text ?? "");
		if (str.length <= maxLength) return str;
		return str.substring(0, maxLength) + "...";
	};

	const CustomTooltip = (props: any) => {
		if (hoveredBar) {
			const filteredPayload =
				props.payload?.filter((p: any) => p.dataKey === hoveredBar.dataKey) ?? [];
			return <ChartTooltipContent {...props} payload={filteredPayload} />;
		}
		if (!props.active || !props.payload?.length) {
			return null;
		}
		return <ChartTooltipContent {...props} />;
	};

	if (isLoading) {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3 border bg-card text-card-foreground shadow-sm rounded-lg">
				<div className="p-6 text-center">Loading...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3 border bg-card text-card-foreground shadow-sm rounded-lg">
				<div className="p-6 text-center text-destructive">
					Error loading data: {error.message}
				</div>
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
					<ChartContainer config={chartConfig}>
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
														{truncateText(payload?.value)}
													</tspan>
												</text>
											)
										: false
								}
							/>

							<ChartTooltip cursor={false} content={<CustomTooltip />} />

							<Bar
								dataKey="passed"
								stackId="a"
								radius={[4, 4, 4, 4]}
								barSize={18}
								name="Passed"
								onMouseEnter={(_, index: number) =>
									setHoveredBar({ index, dataKey: "passed" })
								}
								onMouseLeave={() => setHoveredBar(null)}
								style={{ cursor: "pointer" }}
								fill="hsl(var(--chart-2))"
								onClick={(data) => {
									navigate(
										`/${orgId}/${projectId}/prompt/${data.prompt_id}/testcases?status=passed`,
									);
								}}
							>
								{dataToShow.map((_, index) => (
									<Cell
										key={`cell-passed-${index}`}
										fill={
											hoveredBar?.index === index &&
											hoveredBar?.dataKey === "passed"
												? BAR_COLORS.passed.hover
												: BAR_COLORS.passed.base
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
								onMouseEnter={(_, index: number) =>
									setHoveredBar({ index, dataKey: "failed" })
								}
								onMouseLeave={() => setHoveredBar(null)}
								style={{ cursor: "pointer" }}
								fill="hsl(var(--chart-6))"
								onClick={(data) => {
									navigate(
										`/${orgId}/${projectId}/prompt/${data.prompt_id}/testcases?status=failed`,
									);
								}}
							>
								{dataToShow.map((_, index) => (
									<Cell
										key={`cell-failed-${index}`}
										fill={
											hoveredBar?.index === index &&
											hoveredBar?.dataKey === "failed"
												? BAR_COLORS.failed.hover
												: BAR_COLORS.failed.base
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
							onClick={() => setShowAll(!showAll)}
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
								{totalStats.passed}
							</div>
						</div>
						<div className="px-6 py-2">
							<div className="text-[16px] leading-[20px] font-medium flex items-center gap-1.5 mb-3 text-foreground">
								Failed{" "}
								<XCircle className="w-4 h-4 text-rose-600 dark:text-[#D64646]" />
							</div>
							<div className="text-[24px] leading-[32px] font-bold text-foreground">
								{totalStats.failed}
							</div>
						</div>
						<div className="px-6 py-2">
							<div className="text-[16px] leading-[20px] font-medium flex items-center gap-1.5 mb-3 text-foreground">
								Need Run{" "}
								<AlertCircle className="w-4 h-4 text-amber-600 dark:text-[#cd9932]" />
							</div>
							<div className="text-[24px] leading-[32px] font-bold text-foreground">
								{totalStats.needRun}
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
								{totalStats.total}
							</div>
						</div>
						<div className="flex flex-col px-6 gap-[42px] text-left flex-1">
							<div className="text-[16px] font-medium leading-[20px] text-foreground">
								Error Rate
							</div>
							<div className="text-[30px] font-semibold leading-[22px] text-foreground">
								{errorRate}%
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
