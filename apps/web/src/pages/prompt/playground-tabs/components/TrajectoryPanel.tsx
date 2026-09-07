import { useState } from "react";

import { StepRow } from "@/components/steps/StepRow";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

			<div className="flex flex-col gap-3">
				{trajectory.steps.map((step, index) => {
					const reason = trajectory.mismatchByIndex.get(index);
					// Gated on a comparison having been recorded, not on the testcase
					// having been run: a run that produced a verdict without comparing the
					// steps (a tool the recording does not cover, an AI or MANUAL
					// assertion) gets no marks at all rather than a row of green ticks
					// beside its NOK.
					const outcome = !trajectory.comparisonRecorded
						? undefined
						: step.enabled === false
							? ("not-asserted" as const)
							: reason
								? ("mismatched" as const)
								: ("matched" as const);

					if (step.kind === "final") {
						return (
							<div key={`${step.kind}-${index}`} className="flex items-start gap-3">
								<Checkbox
									className="mt-1"
									checked={step.enabled !== false}
									disabled={trajectory.saving}
									onCheckedChange={(checked) => {
										if (
											checked !== true &&
											trajectory.wouldEmptyTrajectory(index)
										) {
											setConfirmingRemoval(true);
											return;
										}
										trajectory
											.setStepEnabled(index, checked === true)
											.catch(alreadyReported);
									}}
								/>
								<div className="min-w-0 flex-1">
									<div className="font-medium">Final answer</div>
									<p className="text-xs text-muted-foreground">
										Its text is the Expected Output below.
									</p>
									{outcome && (
										<p
											className={
												outcome === "mismatched"
													? "mt-1 text-xs text-destructive"
													: "mt-1 text-xs text-muted-foreground"
											}
										>
											{outcome === "mismatched"
												? `did not match: ${reason}`
												: outcome === "matched"
													? "matched"
													: "not checked"}
										</p>
									)}
								</div>
							</div>
						);
					}

					return (
						<StepRow
							key={`${step.kind}-${index}`}
							step={step}
							outcome={outcome}
							outcomeReason={reason}
							disabled={trajectory.saving}
							onEnabledChange={(enabled) => {
								if (!enabled && trajectory.wouldEmptyTrajectory(index)) {
									setConfirmingRemoval(true);
									return;
								}
								trajectory.setStepEnabled(index, enabled).catch(alreadyReported);
							}}
							onArgsMatchChange={(argsMatch) => {
								trajectory
									.setStepArgsMatch(index, argsMatch)
									.catch(alreadyReported);
							}}
						/>
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
