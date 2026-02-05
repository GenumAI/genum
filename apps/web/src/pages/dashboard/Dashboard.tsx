"use client";

import { useState, useRef, useEffect } from "react";
import { format, addDays } from "date-fns";
import { useProjectUsage } from "@/hooks/useProjectUsage";
import { StatsCards } from "@/pages/dashboard/StatsCard";
import { ChartModelDistribution } from "@/pages/dashboard/ChartModelDistribution";
import { TableModelStats } from "@/pages/dashboard/TableModelStats";
import { TablePromptStats } from "@/pages/dashboard/TablePromptStats";
import { TestcaseStats } from "@/pages/dashboard/TestcaseStats";
import { UserActivityTable } from "@/pages/dashboard/UserActivityTable";
import { Card } from "@/components/ui/card";
import { LogsFilter, LogsFilterState } from "@/pages/logs/LogsFilter";
import { useRefetchOnWorkspaceChange } from "@/hooks/useRefetchOnWorkspaceChange";

export default function DashboardPage() {
	const [filter, setFilter] = useState<LogsFilterState>({
		dateRange: {
			from: addDays(new Date(), -30),
			to: new Date(),
		},
	});

	const [apiDate, setApiDate] = useState<{ from: Date; to: Date }>({
		from: addDays(new Date(), -30),
		to: new Date(),
	});

	useEffect(() => {
		if (filter.dateRange?.from && filter.dateRange?.to) {
			setApiDate({ from: filter.dateRange.from, to: filter.dateRange.to });
		}
	}, [filter.dateRange]);

	const {
		data: apiData,
		isLoading,
		refetch,
	} = useProjectUsage(format(apiDate.from, "yyyy-MM-dd"), format(apiDate.to, "yyyy-MM-dd"));

	const previousDataRef = useRef(apiData);
	if (apiData && !isLoading) {
		previousDataRef.current = apiData;
	}
	const data = apiData || previousDataRef.current;

	useRefetchOnWorkspaceChange(() => {
		refetch();
	});

	// loading / empty
	if (!data) {
		return (
			<div className="text-foreground space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full mt-8">
				<div className="container max-w-full space-y-4">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
						<div className="flex flex-row gap-4">
							<div className="w-[246px] h-10 bg-muted rounded animate-pulse" />
							<div className="w-[400px] h-10 bg-muted rounded animate-pulse" />
						</div>
						<div className="w-[150px] h-10 bg-muted rounded animate-pulse" />
					</div>
					<div className="h-[200px] bg-muted rounded animate-pulse" />
				</div>
			</div>
		);
	}

	return (
		<div className="text-foreground space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full mt-8">
			<div className="container max-w-full space-y-4">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<LogsFilter
						filter={filter}
						setFilter={setFilter}
						promptNames={data?.promptNames || []}
						showFiltersButton={false}
					/>
				</div>

				<StatsCards data={data} />

				<Card className="flex gap-4 shadow-sm rounded-lg p-6 bg-card text-card-foreground">
					<ChartModelDistribution models={data?.models || []} />
					<TableModelStats models={data?.models || []} />
				</Card>

				<TestcaseStats prompts={data?.prompts || []} />

				<TablePromptStats
					prompts={data?.prompts || []}
					promptNames={data?.promptNames || []}
				/>

				<UserActivityTable users={data?.users || []} />
			</div>
		</div>
	);
}
