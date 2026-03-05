import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, CartesianGrid, YAxis } from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo } from "react";
import { TweenNumber } from "./TweenNumber";

interface Props {
	title: string;
	value: number;
	formatValue?: (value: number) => string;
	subtitle?: string;
	data: { date: string; value: number }[];
	label?: string;
}

function getTextWidth(text: string, font = "12px Arial") {
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) return 0;
	context.font = font;
	return context.measureText(text).width;
}

export function StatsCardWithLineChart({
	title,
	value,
	formatValue,
	subtitle,
	data,
	label,
}: Props) {
	const chartConfig: ChartConfig = useMemo(
		() => ({
			value: {
				label: label ?? title,
				color: "#6C98F2",
			},
		}),
		[label, title],
	);

	const leftMargin = useMemo(() => {
		const maxValue = Math.max(...data.map((d) => d.value));
		const maxValueFormatted = maxValue.toLocaleString(undefined, { maximumFractionDigits: 5 });
		return getTextWidth(maxValueFormatted) + 12;
	}, [data]);
	const chartAnimationKey = `${title}-${data.length}-${data[data.length - 1]?.value ?? 0}`;

	return (
		<Card className="p-6 rounded-lg shadow-sm">
			<CardHeader className="p-0">
				<CardTitle className="text-[14px] text-medium mb-2 text-[#09090B] dark:text-foreground">
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				<div className="flex flex-row gap-2 items-end mb-6">
					<TweenNumber
						value={value}
						formatValue={formatValue}
						className="text-[24px] text-[#09090B] dark:text-foreground font-bold leading-[100%]"
					/>
					{subtitle && (
						<div className="text-[12px] text-muted-foreground">{subtitle}</div>
					)}
				</div>
				<div>
					<ChartContainer config={chartConfig}>
						<LineChart
							key={chartAnimationKey}
							accessibilityLayer
							data={data}
							margin={{ left: leftMargin, top: 6, right: 12 }}
						>
							<CartesianGrid vertical={false} />
							<YAxis
								width={20}
								dataKey="value"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
							/>
							<XAxis
								dataKey="date"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
							/>
							<ChartTooltip
								cursor={false}
								content={<ChartTooltipContent hideLabel />}
							/>
							<Line
								dataKey="value"
								type="linear"
								stroke="var(--color-value)"
								strokeWidth={2}
								dot={false}
								isAnimationActive
								animationDuration={950}
								animationBegin={120}
								animationEasing="ease-out"
							/>
						</LineChart>
					</ChartContainer>
				</div>
			</CardContent>
		</Card>
	);
}
