import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { StepRow } from "@/components/steps/StepRow";
import { enabledCount } from "@/lib/trajectoryEdits";
import type { Step } from "@/types/steps";

interface TestcaseStepPickerDialogProps {
	open: boolean;
	trajectory: Step[];
	/**
	 * Indices into `trajectory` whose recorded arguments could not be read (see
	 * `spansToSteps`/`MappedTrajectory`). Display-only: it is never merged into a step and
	 * never reaches `onConfirm`'s payload -- `steps` state below is built solely from
	 * `trajectory`/`withDefaults`, which never carries this field.
	 */
	unreadableArgsIndices?: Set<number>;
	/** A create request is in flight -- keeps the author from submitting twice. */
	saving?: boolean;
	onCancel: () => void;
	onConfirm: (steps: Step[]) => void;
}

/**
 * Every tool call and the final answer start ticked (spec decision 4). The author
 * unticks the noise -- an unticked step stays visible so it is clear what was ignored.
 *
 * `argsMatch` is only defaulted when the mapper has not already pinned one: a step whose
 * recorded arguments could not be parsed arrives as `"ignore"`, and quietly promoting
 * that to `"exact"` here would assert `{}` as the expected arguments.
 */
function withDefaults(trajectory: Step[]): Step[] {
	return trajectory.map((step) =>
		step.kind === "tool_call"
			? { ...step, enabled: step.enabled ?? true, argsMatch: step.argsMatch ?? "exact" }
			: { ...step, enabled: step.enabled ?? true },
	);
}

export function TestcaseStepPickerDialog({
	open,
	trajectory,
	unreadableArgsIndices,
	saving = false,
	onCancel,
	onConfirm,
}: TestcaseStepPickerDialogProps) {
	const [steps, setSteps] = useState<Step[]>(() => withDefaults(trajectory));

	// The dialog is not remounted between logs, so the initial state alone would pin the
	// first trajectory it ever saw and show it for every later log.
	useEffect(() => {
		setSteps(withDefaults(trajectory));
	}, [trajectory]);

	const update = (index: number, patch: Partial<Step>) =>
		setSteps((current) =>
			current.map((step, i) => (i === index ? ({ ...step, ...patch } as Step) : step)),
		);

	// A testcase with nothing enabled asserts nothing and can never fail -- exactly what
	// this feature exists to prevent. The backend's `StepsSchema.min(1)` counts the array,
	// not the ticks, so it would accept this; the block has to be here.
	//
	// `enabledCount` and not a filter of its own: the server's `hasEnabledStep` runs on
	// `effectiveSteps` and skips `user` steps, so counting every ticked step here let a
	// selection whose only ticks sit past a cut reply -- or are replies themselves --
	// through a dialog that told the author it asserted something. One statement of the
	// rule per side, and this is web's.
	const assertedCount = enabledCount(steps);

	return (
		<Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Which steps must stay correct?</DialogTitle>
					<DialogDescription>
						Ticked steps are asserted on every run. Unticked ones stay on the testcase
						for context but are never checked.
					</DialogDescription>
				</DialogHeader>

				<div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
					{steps.map((step, index) => (
						<StepRow
							key={`${step.kind}-${index}`}
							step={step}
							unreadableArgs={unreadableArgsIndices?.has(index)}
							onEnabledChange={(enabled) => update(index, { enabled })}
							onArgsMatchChange={(argsMatch) => update(index, { argsMatch })}
						/>
					))}
				</div>

				{assertedCount === 0 && (
					<p className="text-sm text-destructive">
						Tick at least one step. A testcase that asserts nothing always passes.
					</p>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={onCancel} disabled={saving}>
						Cancel
					</Button>
					<Button
						onClick={() => onConfirm(steps)}
						disabled={saving || assertedCount === 0}
					>
						{saving ? "Creating..." : "Create testcase"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
