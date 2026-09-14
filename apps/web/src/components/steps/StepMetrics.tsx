import { CircleGauge, Coins, Ticket } from "lucide-react";

import type { ThreadMetrics } from "@/lib/thread";

/**
 * Formats the way `outputUtils.formatNumber` does -- an integer unchanged, anything else
 * to four decimal places. Restated here rather than imported: that module lives under
 * `pages/`, and a component reaching up into a page's utils inverts the dependency the
 * rest of `components/` keeps. Two lines of arithmetic are the cheaper of the two.
 */
function format(value: number): number {
	return Number.isInteger(value) ? value : Number.parseFloat(value.toFixed(4));
}

/**
 * One turn's measured usage, rendered beside the answer it belongs to.
 *
 * Rendered ONLY where the usage was actually measured (D5). A recorded trajectory has
 * none: its span rows carry zeros as placeholders keeping the OTel-shaped schema intact,
 * and a row of zeros here would tell the author the turn was free and instant. The caller
 * decides by passing `metrics` or not; this component never invents a zero.
 */
export function StepMetrics({ metrics }: { metrics: ThreadMetrics }) {
	const seconds = metrics.responseTimeMs / 1000;

	return (
		<div className="flex flex-wrap items-center gap-2.5 text-muted-foreground">
			{metrics.tokens !== 0 && (
				<span className="flex items-center gap-1 text-xs">
					<Ticket className="h-4 w-4" />
					{format(metrics.tokens)}
				</span>
			)}
			{metrics.cost !== 0 && (
				<span className="flex items-center gap-1 text-xs">
					<Coins className="h-4 w-4" />
					{format(metrics.cost)}
				</span>
			)}
			{seconds !== 0 && (
				<span className="flex items-center gap-1 text-xs">
					<CircleGauge className="h-4 w-4" />
					{format(seconds)} sec
				</span>
			)}
		</div>
	);
}
