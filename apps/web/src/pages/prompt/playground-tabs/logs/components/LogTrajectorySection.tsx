import { useQuery } from "@tanstack/react-query";

import { projectApi } from "@/api/project/project.api";
import { StepRow } from "@/components/steps/StepRow";
import { spansToSteps } from "@/lib/spansToSteps";
import { logsKeys } from "@/query-keys/logs.keys";

interface LogTrajectorySectionProps {
	traceId: string;
}

export function LogTrajectorySection({ traceId }: LogTrajectorySectionProps) {
	const { data, isLoading, isError } = useQuery({
		queryKey: logsKeys.traceSpans(traceId),
		queryFn: async () => {
			const response = await projectApi.getTraceSpans(traceId);
			return spansToSteps(response.spans ?? []);
		},
	});

	return (
		<div>
			<p className="mb-1 font-medium text-xs leading-none tracking-normal text-muted-foreground">
				Trajectory
			</p>
			<div className="rounded-[6px] border p-4">
				{isLoading && <p className="text-sm text-muted-foreground">Loading the trace…</p>}
				{/* An empty list and a failed read look identical if the failure is silent,
				    and they mean opposite things: "this run called no tools" versus "we
				    could not tell you what it did". */}
				{isError && (
					<p className="text-sm text-destructive">
						The recorded trace could not be loaded.
					</p>
				)}
				{data && data.steps.length === 0 && !isLoading && !isError && (
					<p className="text-sm text-muted-foreground">This run recorded no steps.</p>
				)}
				{data && data.steps.length > 0 && (
					<div className="flex flex-col gap-3">
						{data.steps.map((step, index) => (
							<StepRow
								key={`${step.kind}-${index}`}
								step={step}
								unreadableArgs={data.unreadableArgsIndices.has(index)}
								readOnly
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
