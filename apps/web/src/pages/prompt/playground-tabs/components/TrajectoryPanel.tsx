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

	// `lastSteps` is written on every trajectory run, so a non-empty one means the
	// testcase has been run. `Boolean([])` is true, so the length check is load-bearing:
	// without it a never-run testcase would claim a verdict it does not have.
	const hasRun = Array.isArray(testcase?.lastSteps) && testcase.lastSteps.length > 0;

	return (
		<div className="flex flex-col gap-3 rounded-[6px] border p-4">
			<div className="flex items-center justify-between">
				<p className="font-medium text-sm">
					Trajectory · {trajectory.steps.length}{" "}
					{trajectory.steps.length === 1 ? "step" : "steps"}
				</p>
				<p className="text-xs text-muted-foreground">
					{hasRun
						? // The verdict is deliberately NOT recomputed when expectations
							// change, so it can describe rules that no longer apply. Saying
							// when it was produced is what keeps that honest.
							`Last run ${new Date(trajectory.lastRunAt ?? "").toLocaleString()}`
						: "Not run yet"}
				</p>
			</div>

			<div className="flex flex-col gap-3">
				{trajectory.steps.map((step, index) => {
					const reason = trajectory.mismatchByIndex.get(index);
					const outcome = !hasRun
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
										void trajectory.setStepEnabled(index, checked === true);
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
								void trajectory.setStepEnabled(index, enabled);
							}}
							onArgsMatchChange={(argsMatch) => {
								void trajectory.setStepArgsMatch(index, argsMatch);
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
						void trajectory.setOrderMatters(checked === true);
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
								void trajectory.removeTrajectory().then(() => {
									setConfirmingRemoval(false);
								});
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
