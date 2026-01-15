import { memo } from "react";
import type { ReactElement } from "react";
import { Clock, Ticket, Coins } from "lucide-react";
import type {
	RunMetricsProps,
	ExecutionMetricsProps,
	CostBreakdownMetricsProps,
} from "../utils/types";
import { formatCost, formatTime } from "../utils/formatters";

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

export const RunMetrics = memo(({ tokens, cost }: RunMetricsProps) => {
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
});

RunMetrics.displayName = "RunMetrics";

export const ExecutionMetrics = memo(
	({ settings, responseTime, promptTokens, completionTokens }: ExecutionMetricsProps) => {
		const hasData =
			responseTime != null ||
			settings?.completionTokensMax ||
			promptTokens ||
			completionTokens;

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
					{!!settings?.completionTokensMax && (
						<MetricsRow
							icon={<Ticket size={16} />}
							title={"Total tokens"}
							value={settings?.completionTokensMax}
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
							title={"Prompt cost"}
							value={formatCost(promptCost)}
						/>
					)}
					{!!completionCost && (
						<MetricsRow
							icon={<Coins size={16} />}
							title={"Completion cost"}
							value={formatCost(completionCost)}
						/>
					)}
					{!!totalCost && (
						<MetricsRow
							icon={<Coins size={16} />}
							title={"Total cost"}
							value={formatCost(totalCost)}
						/>
					)}
				</ul>
			</div>
		);
	},
);

CostBreakdownMetrics.displayName = "CostBreakdownMetrics";
