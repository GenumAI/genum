import { StatsCardWithLineChart } from "./StatsCardWithLineChart";

export function StatsCards({ data }: { data: any }) {
	const transformDailyStats = (dailyStats: any[], field: string) => {
		return dailyStats.map((stat) => ({
			date: new Date(stat.date).toLocaleDateString("en-US", {
				month: "numeric",
				day: "numeric",
			}),
			value: stat[field] || 0,
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
			value={data.total_requests.toString()}
			subtitle="Runs made"
			data={requestsChartData}
		/>
		<StatsCardWithLineChart
			title="Total Tokens"
			label="Tokens"
			value={data.total_tokens_sum.toLocaleString()}
			subtitle="Tokens used"
			data={tokensChartData}
		/>
		<StatsCardWithLineChart
			title="Total Cost"
			label="Cost"
			value={`$${data.total_cost.toFixed(2)}`}
			subtitle="Usage cost"
			data={costChartData}
		/>
		</div>
	);
}
