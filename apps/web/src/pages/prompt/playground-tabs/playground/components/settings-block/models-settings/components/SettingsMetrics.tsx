import { memo } from "react";
import type { ReactElement } from "react";
import { Clock, Ticket, Coins } from "lucide-react";
import type {
	RunMetricsProps,
	ExecutionMetricsProps,
	CostBreakdownMetricsProps,
} from "../utils/types";
import { formatCost, formatTime } from "../utils/formatters";

const isSameValue = (a: number | null | undefined, b: number | null | undefined) => a === b;

const isSameTimeParam = (
	a: RunMetricsProps["tokens"] | RunMetricsProps["cost"],
	b: RunMetricsProps["tokens"] | RunMetricsProps["cost"],
) => {
	if (a === b) return true;
	if (!a && !b) return true;
	if (!a || !b) return false;
	return a.prompt === b.prompt && a.completion === b.completion && a.total === b.total;
};

const MetricsRow = ({
	icon,
	title,
	value,
}: {
	icon: ReactElement;
	title: string;
	value: number | string;
}) => {
	return (
		<li className="flex justify-between items-center text-[#18181B] dark:text-white font-sans text-[10px] not-italic font-normal leading-[16px]">
			<div className="flex items-center gap-2">
				{icon} {title}
			</div>
			<span>{value}</span>
		</li>
	);
};

export const RunMetrics = memo(
	({ tokens, cost }: RunMetricsProps) => {
		return (
			<div className="flex flex-col gap-2">
				<span className="text-[#18181B] dark:text-white font-sans text-[14px] not-italic font-bold leading-[14px]">
					Run Metrics
				</span>
				<ul className="flex flex-col gap-1.5">
					{tokens && (
						<MetricsRow
							icon={<Ticket size={16} />}
							title={"Token Usage"}
							value={tokens.total}
						/>
					)}
					{cost && (
						<MetricsRow
							icon={<Coins size={16} />}
							title={"Cost"}
							value={formatCost(cost.total)}
						/>
					)}
				</ul>
			</div>
		);
	},
	(prev, next) => isSameTimeParam(prev.tokens, next.tokens) && isSameTimeParam(prev.cost, next.cost),
);

RunMetrics.displayName = "RunMetrics";

export const ExecutionMetrics = memo(
	({ responseTime, totalTokens, promptTokens, completionTokens }: ExecutionMetricsProps) => {
		const hasData = responseTime != null || totalTokens || promptTokens || completionTokens;

		if (!hasData) {
			return null;
		}

		return (
			<div className="flex flex-col gap-2">
				<span className="text-[#18181B] dark:text-white font-sans text-[14px] not-italic font-bold leading-[14px]">
					Execution Metrics
				</span>
				<ul className="flex flex-col gap-1.5">
					{responseTime != null && (
						<MetricsRow
							icon={<Clock size={16} />}
							title={"Response time"}
							value={formatTime(responseTime)}
						/>
					)}
					{!!totalTokens && (
						<MetricsRow
							icon={<Ticket size={16} />}
							title={"Total tokens"}
							value={totalTokens}
						/>
					)}
					{!!promptTokens && (
						<MetricsRow
							icon={<Ticket size={16} />}
							title={"Prompt tokens"}
							value={promptTokens}
						/>
					)}
					{!!completionTokens && (
						<MetricsRow
							icon={<Ticket size={16} />}
							title={"Completion tokens"}
							value={completionTokens}
						/>
					)}
				</ul>
			</div>
		);
	},
	(prev, next) =>
		isSameValue(prev.responseTime, next.responseTime) &&
		isSameValue(prev.totalTokens, next.totalTokens) &&
		isSameValue(prev.promptTokens, next.promptTokens) &&
		isSameValue(prev.completionTokens, next.completionTokens),
);

ExecutionMetrics.displayName = "ExecutionMetrics";

export const CostBreakdownMetrics = memo(
	({ promptCost, completionCost, totalCost }: CostBreakdownMetricsProps) => {
		if (!promptCost && !completionCost && !totalCost) {
			return null;
		}

		return (
			<div className="flex flex-col gap-2">
				<span className="text-[#18181B] dark:text-white font-sans text-[14px] not-italic font-bold leading-[14px]">
					Cost Breakdown
				</span>
				<ul className="flex flex-col gap-1.5">
					{!!promptCost && (
						<MetricsRow
							icon={<Coins size={16} />}
							title={"Prompt Cost"}
							value={formatCost(promptCost)}
						/>
					)}
					{!!completionCost && (
						<MetricsRow
							icon={<Coins size={16} />}
							title={"Completion Cost"}
							value={formatCost(completionCost)}
						/>
					)}
					{!!totalCost && (
						<MetricsRow
							icon={<Coins size={16} />}
							title={"Total Cost"}
							value={formatCost(totalCost)}
						/>
					)}
				</ul>
			</div>
		);
	},
);

CostBreakdownMetrics.displayName = "CostBreakdownMetrics";
