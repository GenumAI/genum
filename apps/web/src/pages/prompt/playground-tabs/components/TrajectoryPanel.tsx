import { useState } from "react";

import { StepRow } from "@/components/steps/StepRow";
import { TurnSection } from "@/components/steps/TurnSection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { effectiveSteps, turnsOf } from "@/lib/session";
import { useTestcaseTrajectory } from "@/pages/prompt/playground-tabs/playground/hooks/useTestcaseTrajectory";
import type { TestCase } from "@/types/TestСase";

interface TrajectoryPanelProps {
	testcaseId?: string | number | null;
	testcase?: TestCase | null;
}

export function TrajectoryPanel({ testcaseId, testcase }: TrajectoryPanelProps) {
	const trajectory = useTestcaseTrajectory({ testcaseId, testcase });
	const [confirmingRemoval, setConfirmingRemoval] = useState(false);

	if (!trajectory.hasTrajectory) return null;

	// `useTestcaseTrajectory` already surfaces a toast on failure, and nothing here is
	// optimistic -- every control reads the persisted value, so a rejected write needs no
	// rollback. Swallowing the rejection is therefore the whole handler: without it each
	// failed save also logs an unhandled promise rejection.
	const alreadyReported = () => {};

	// `effectiveSteps` slices UP TO but NOT INCLUDING the unticked `user` step that ends
	// the session, so its length equals that step's OWN flat index. That step is the live
	// control that created the cut, not one the session failed to reach -- it must stay
	// enabled so the cut can be undone from this panel -- so only steps STRICTLY AFTER it
	// (index > cutIndex) are dead. With no cut, `cutIndex` is `steps.length`, past every
	// valid index, so nothing is ever dead.
	const cutIndex = effectiveSteps(trajectory.steps).length;
	const hasCut = cutIndex < trajectory.steps.length;

	return (
		<div className="flex flex-col gap-3 rounded-[6px] border p-4">
			<div className="flex items-center justify-between">
				<p className="font-medium text-sm">
					Trajectory · {trajectory.steps.length}{" "}
					{trajectory.steps.length === 1 ? "step" : "steps"}
				</p>
				<p className="text-xs text-muted-foreground">
					{/*
					 * The verdict is deliberately NOT recomputed when expectations change,
					 * so it can describe rules that no longer apply. Saying when it was
					 * produced is what keeps that honest -- which is why an absent
					 * timestamp reports "not run yet" rather than `new Date(null)`'s
					 * literal "Invalid Date". `lastRunAt` is nullable: a row that predates
					 * the column, and every testcase never run, has none.
					 */}
					{trajectory.hasRun && trajectory.lastRunAt
						? `Last run ${new Date(trajectory.lastRunAt).toLocaleString()}`
						: "Not run yet"}
				</p>
			</div>

			<div className="flex flex-col gap-4">
				{turnsOf(trajectory.steps).map((turn, turnPosition) => {
					const rows = turn.steps.map((step, position) => {
						// The row's flat index -- what `mismatchByIndex` and every save
						// call address it by. A turn-local index would silently mark or
						// save the wrong step.
						const index = turn.start + position;
						const reason = trajectory.mismatchByIndex.get(index);
						const dead = index > cutIndex;

						// Gated on a comparison having been recorded, not on the
						// testcase having been run: a run that produced a verdict
						// without comparing the steps (a tool the recording does not
						// cover, an AI or MANUAL assertion) gets no marks at all rather
						// than a row of green ticks beside its NOK.
						const outcome = dead
							? ("not-reached" as const)
							: !trajectory.comparisonRecorded
								? undefined
								: step.enabled === false
									? ("not-asserted" as const)
									: reason
										? ("mismatched" as const)
										: ("matched" as const);

						return { step, index, reason, dead, outcome };
					});

					const liveCount = rows.filter((row) => !row.dead).length;
					const hasMismatch = rows.some((row) => row.outcome === "mismatched");
					const isCutTurn = hasCut && rows.some((row) => row.index === cutIndex);

					return (
						<TurnSection
							key={turn.start}
							turnNumber={turnPosition + 1}
							liveStepCount={liveCount === 0 ? null : liveCount}
							totalStepCount={rows.length}
							hasMismatch={hasMismatch}
							isCutTurn={isCutTurn}
						>
							{rows.map(({ step, index, reason, dead, outcome }) => (
								<StepRow
									key={`${step.kind}-${index}`}
									step={step}
									outcome={outcome}
									outcomeReason={reason}
									disabled={trajectory.saving || dead}
									onEnabledChange={(enabled) => {
										if (!enabled && trajectory.wouldEmptyTrajectory(index)) {
											setConfirmingRemoval(true);
											return;
										}
										trajectory
											.setStepEnabled(index, enabled)
											.catch(alreadyReported);
									}}
									onArgsMatchChange={(argsMatch) => {
										trajectory
											.setStepArgsMatch(index, argsMatch)
											.catch(alreadyReported);
									}}
									onTextChange={(text) => trajectory.setStepText(index, text)}
								/>
							))}
						</TurnSection>
					);
				})}
			</div>

			<div className="flex items-center gap-2">
				<Checkbox
					checked={trajectory.stepsConfig.orderMatters}
					disabled={trajectory.saving}
					onCheckedChange={(checked) => {
						trajectory.setOrderMatters(checked === true).catch(alreadyReported);
					}}
				/>
				<span className="text-sm">Steps must happen in this order</span>
			</div>

			{confirmingRemoval && (
				<div className="flex flex-col gap-2 rounded-[6px] border border-destructive p-3">
					<p className="text-sm">
						That was the last checked step. A testcase that asserts nothing always
						passes, so the trajectory has to go with it — the testcase stays, as a plain
						text one.
					</p>
					<div className="flex gap-2">
						<Button
							variant="destructive"
							disabled={trajectory.saving}
							onClick={() => {
								trajectory
									.removeTrajectory()
									.then(() => {
										setConfirmingRemoval(false);
									})
									.catch(alreadyReported);
							}}
						>
							Remove the trajectory
						</Button>
						<Button
							variant="outline"
							disabled={trajectory.saving}
							onClick={() => setConfirmingRemoval(false)}
						>
							Cancel
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
