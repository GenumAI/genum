import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
	buildColorByNameMap,
	getDistributionTotal,
	toDistributionChartData,
	type DistributionModelInput,
} from "@/pages/dashboard/utils/chartDistribution";
import { TweenNumber } from "./TweenNumber";

interface Props {
	models: DistributionModelInput[];
	isLoading?: boolean;
}

const CHART_COLORS = [
	"hsl(var(--chart-1))",
	"hsl(var(--chart-2))",
	"hsl(var(--chart-3))",
	"hsl(var(--chart-4))",
	"hsl(var(--chart-5))",
	"hsl(var(--chart-6))",
	"hsl(var(--chart-7))",
	"hsl(var(--chart-8))",
	"hsl(var(--chart-9))",
	"hsl(var(--chart-10))",
	"hsl(var(--chart-11))",
	"hsl(var(--chart-12))",
];

export function ChartModelDistribution({ models, isLoading = false }: Props) {
	if (isLoading) {
		return (
			<Card className="flex flex-col border-0 shadow-none bg-card text-card-foreground">
				<CardHeader className="p-0 pb-4">
					<Skeleton className="h-6 w-[260px]" />
				</CardHeader>
				<CardContent className="h-[100%] flex gap-6 items-center p-0 pr-6">
					<Skeleton className="h-[220px] w-[220px] rounded-full" />
					<div className="flex flex-col gap-3 flex-1">
						<Skeleton className="h-4 w-[180px]" />
						<Skeleton className="h-4 w-[210px]" />
						<Skeleton className="h-4 w-[170px]" />
						<Skeleton className="h-4 w-[200px]" />
					</div>
				</CardContent>
			</Card>
		);
	}

	const total = getDistributionTotal(models);
	const chartData = toDistributionChartData(models);

	const emptyChartData = [{ name: "No data", value: 1 }];
	const hasData = total > 0;
	const colorByModelName = buildColorByNameMap(chartData, CHART_COLORS);

	return (
		<Card className="flex flex-col border-0 shadow-none bg-card text-card-foreground">
			<CardHeader className="p-0 pb-4">
				<CardTitle className="text-foreground">Model Distribution by Requests</CardTitle>
			</CardHeader>

			<CardContent className="h-[100%] flex gap-6 items-center p-0 pr-6">
				{/* Pie */}
				<div className="relative w-[260px] h-[260px]">
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie
								data={hasData ? chartData : emptyChartData}
								cx="50%"
								cy="50%"
								innerRadius={45}
								outerRadius={80}
								dataKey="value"
								strokeWidth={2}
								stroke={"hsl(var(--background))"}
								isAnimationActive
								animationDuration={1100}
								animationBegin={180}
								animationEasing="ease-out"
							>
								{hasData ? (
									chartData.map((entry) => (
										<Cell
											key={`pie-cell-${entry.name}`}
											fill={
												colorByModelName.get(entry.name) ??
												CHART_COLORS[0]
											}
										/>
									))
								) : (
									<Cell key="empty" fill="hsl(var(--muted))" />
								)}
							</Pie>
						</PieChart>
					</ResponsiveContainer>

					{/* Total */}
					<div className="absolute inset-0 flex items-center justify-center">
						<TweenNumber
							value={total}
							className="text-2xl font-bold text-foreground"
							formatValue={(value) => `${Math.round(value)}`}
						/>
					</div>
				</div>

				{/* Legend */}
				<div className="flex flex-col gap-3">
					{hasData ? (
						chartData.map((entry) => (
							<div key={`legend-${entry.name}`} className="flex items-center gap-2 h-4">
								<span
									className="h-2 w-2 rounded-[2px]"
									style={{
										backgroundColor:
											colorByModelName.get(entry.name) ?? CHART_COLORS[0],
									}}
								/>
								<span className="text-[12px] text-foreground/90">{entry.name}</span>
								<TweenNumber
									value={entry.value}
									className="ml-auto font-semibold bg-muted text-foreground/90 px-[3px] min-w-[23px] text-center rounded-md text-[10px]"
									formatValue={(value) => `${Math.round(value)}`}
								/>
							</div>
						))
					) : (
						<div className="flex items-center gap-2 h-4">
							<span className="h-2 w-2 rounded-[2px] bg-muted" />
							<span className="text-[12px] text-muted-foreground">No data</span>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
