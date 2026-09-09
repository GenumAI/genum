import { useQuery } from "@tanstack/react-query";

import { projectApi } from "@/api/project/project.api";
import { StepRow } from "@/components/steps/StepRow";
import { TurnSection } from "@/components/steps/TurnSection";
import { turnsOf } from "@/lib/session";
import { isSingleAnswer, spansToSteps } from "@/lib/spansToSteps";
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

	// Every run opens a session now, so almost every log row has a trace and this
	// component mounts on almost every log. A session of one plain answer has nothing to
	// show -- one row repeating the output field already on screen above it -- so it
	// renders nothing at all rather than a header over a duplicate. The same silence
	// covers the load: the alternative is a "Trajectory / Loading the trace…" box
	// flashing on every plain log and then vanishing.
	//
	// An EMPTY list is excluded deliberately -- that is a session whose turn was
	// abandoned, and "This run recorded no steps." below is the thing worth saying
	// about it.
	if (isLoading || (data && !isError && data.steps.length > 0 && isSingleAnswer(data.steps)))
		return null;

	return (
		<div>
			<p className="mb-1 font-medium text-xs leading-none tracking-normal text-muted-foreground">
				Trajectory
			</p>
			<div className="rounded-[6px] border p-4">
				{/* An empty list and a failed read look identical if the failure is silent,
				    and they mean opposite things: "this run called no tools" versus "we
				    could not tell you what it did".
				    A failure can also arrive while a previous read's steps are still cached
				    -- a background refetch on window focus is enough. Hiding them would drop
				    a chain the author was reading, and showing them under a bare error would
				    leave them unable to tell whether it is current, so the message says which
				    of the two situations this is. */}
				{isError && (
					<p className="text-sm text-destructive">
						{data && data.steps.length > 0
							? "The trace could not be re-read; these are the steps from the last successful read."
							: "The recorded trace could not be loaded."}
					</p>
				)}
				{data && data.steps.length === 0 && !isLoading && !isError && (
					<p className="text-sm text-muted-foreground">This run recorded no steps.</p>
				)}
				{data && data.steps.length > 0 && (
					<div className="flex flex-col gap-4">
						{/* A recorded trace has no truncation and no comparison of its own --
						    it is simply what happened -- so every turn is fully live and
						    nothing here forces a turn open by default the way a mismatch or
						    a live cut would in the panel. */}
						{turnsOf(data.steps).map((turn, turnPosition) => (
							<TurnSection
								key={turn.start}
								turnNumber={turnPosition + 1}
								liveStepCount={turn.steps.length}
								totalStepCount={turn.steps.length}
							>
								{turn.steps.map((step, position) => {
									// The row's flat index -- what `unreadableArgsIndices`
									// addresses it by.
									const index = turn.start + position;
									return (
										<StepRow
											key={`${step.kind}-${index}`}
											step={step}
											unreadableArgs={data.unreadableArgsIndices.has(index)}
											readOnly
										/>
									);
								})}
							</TurnSection>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
