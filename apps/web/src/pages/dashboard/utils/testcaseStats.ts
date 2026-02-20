import type { ChartConfig } from "@/components/ui/chart";
import type { ChartDataItem } from "@/pages/dashboard/hooks/useTestcasesGroupedByPrompt";

export interface TestcaseTotals {
	total: number;
	passed: number;
	failed: number;
	needRun: number;
}

export function getTestcaseTotals(chartData: ChartDataItem[]): TestcaseTotals {
	if (!chartData.length) {
		return { total: 0, passed: 0, failed: 0, needRun: 0 };
	}

	return chartData.reduce(
		(acc, item) => ({
			total: acc.total + item.passed + item.failed + item.needRun,
			passed: acc.passed + item.passed,
			failed: acc.failed + item.failed,
			needRun: acc.needRun + item.needRun,
		}),
		{ total: 0, passed: 0, failed: 0, needRun: 0 } as TestcaseTotals,
	);
}

export function getTestcaseErrorRate(totals: TestcaseTotals): number {
	if (totals.total === 0) return 0;
	return Math.round((totals.failed / totals.total) * 100);
}

export function truncateChartLabel(text: unknown, maxLength: number = 20): string {
	const str = typeof text === "string" ? text : String(text ?? "");
	if (str.length <= maxLength) return str;
	return `${str.substring(0, maxLength)}...`;
}

export const testcaseChartConfig = {
	passed: { label: "Passed", color: "hsl(var(--chart-2))" },
	failed: { label: "Failed", color: "hsl(var(--chart-6))" },
	label: { color: "hsl(var(--foreground))" },
} satisfies ChartConfig;

export const testcaseBarColors = {
	passed: { base: "hsl(var(--chart-2) / 0.75)", hover: "hsl(var(--chart-2))" },
	failed: { base: "hsl(var(--chart-6) / 0.75)", hover: "hsl(var(--chart-6))" },
};
