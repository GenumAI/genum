import type {
	UsageData,
	UsageDailyStat,
	UsageDailyStatField,
} from "@/api/project/project.api";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCardWithLineChart } from "./StatsCardWithLineChart";

interface Props {
	data?: UsageData;
	isLoading?: boolean;
}

export function StatsCards({ data, isLoading = false }: Props) {
	if (isLoading) {
		return (
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Skeleton className="h-[200px] rounded-lg" />
				<Skeleton className="h-[200px] rounded-lg" />
				<Skeleton className="h-[200px] rounded-lg" />
			</div>
		);
	}

	if (!data) {
		return null;
	}

	const transformDailyStats = (dailyStats: UsageDailyStat[], field: UsageDailyStatField) => {
		return dailyStats.map((stat) => ({
			date: new Date(stat.date).toLocaleDateString("en-US", {
				month: "numeric",
				day: "numeric",
			}),
			value: stat[field] ?? 0,
		}));
	};

	const requestsChartData = transformDailyStats(data.daily_stats || [], "total_requests");
	const tokensChartData = transformDailyStats(data.daily_stats || [], "total_tokens_sum");
	const costChartData = transformDailyStats(data.daily_stats || [], "total_cost");

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			<StatsCardWithLineChart
				title="Total Requests"
				label="Requests"
				value={data.total_requests}
				formatValue={(value) => Math.round(value).toLocaleString()}
				subtitle="Runs made"
				data={requestsChartData}
			/>
			<StatsCardWithLineChart
				title="Total Tokens"
				label="Tokens"
				value={data.total_tokens_sum}
				formatValue={(value) => Math.round(value).toLocaleString()}
				subtitle="Tokens used"
				data={tokensChartData}
			/>
			<StatsCardWithLineChart
				title="Total Cost"
				label="Cost"
				value={data.total_cost}
				formatValue={(value) => `$${value.toFixed(2)}`}
				subtitle="Usage cost"
				data={costChartData}
			/>
		</div>
	);
}
