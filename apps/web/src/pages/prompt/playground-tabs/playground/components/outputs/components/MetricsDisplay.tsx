import type React from "react";
import { Ticket, Coins, CircleGauge } from "lucide-react";
import { CardTitle } from "@/components/ui/card";
import type { PromptResponse } from "@/hooks/useRunPrompt";
import { getSeconds, formatNumber } from "../utils/outputUtils";

interface MetricsDisplayProps {
	title: string;
	content?: PromptResponse;
}

export const MetricsDisplay: React.FC<MetricsDisplayProps> = ({ title, content }) => {
	const tokensTotal = content?.tokens?.total;
	const costTotal = content?.cost?.total;
	const responseTimeSeconds = getSeconds(content?.response_time_ms);

	const shouldShowTokens = typeof tokensTotal === "number" && tokensTotal !== 0;
	const shouldShowCost = typeof costTotal === "number" && costTotal !== 0;
	const shouldShowResponseTime =
		typeof responseTimeSeconds === "number" && responseTimeSeconds !== 0;

	return (
		<div className="flex items-center justify-between py-[18px] px-[7px] h-[60px]">
			<div className="flex flex-wrap items-center text-muted-foreground gap-2.5">
				<CardTitle className="text-sm font-medium text-foreground mr-1">{title}</CardTitle>
				{shouldShowTokens && (
					<span className="flex items-center text-zinc-500 text-xs gap-1">
						<Ticket className="w-4 h-4" />
						{formatNumber(tokensTotal)}
					</span>
				)}
				{shouldShowCost && (
					<span className="flex items-center text-zinc-500 text-xs gap-1">
						<Coins className="w-4 h-4" />
						{formatNumber(costTotal)}
					</span>
				)}
				{shouldShowResponseTime && (
					<span className="flex items-center text-zinc-500 text-xs gap-1">
						<CircleGauge className="w-4 h-4" />
						{formatNumber(responseTimeSeconds)} sec
					</span>
				)}
			</div>
		</div>
	);
};
