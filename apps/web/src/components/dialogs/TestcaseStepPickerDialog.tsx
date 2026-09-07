import { useEffect, useState } from "react";
import { ChatText, Wrench } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ArgsMatch, Step } from "@/types/steps";

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
	const enabledCount = steps.filter((step) => step.enabled !== false).length;

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
						<div key={`${step.kind}-${index}`} className="flex items-start gap-3">
							<Checkbox
								className="mt-1"
								checked={step.enabled !== false}
								onCheckedChange={(checked) =>
									update(index, { enabled: checked === true })
								}
							/>
							{step.kind === "tool_call" ? (
								<Wrench className="mt-1 shrink-0" size={16} />
							) : (
								<ChatText className="mt-1 shrink-0" size={16} />
							)}
							<div className="min-w-0 flex-1">
								{step.kind === "tool_call" ? (
									<>
										<div className="font-medium">{step.name}</div>
										<pre className="mt-1 overflow-x-auto text-xs">
											{JSON.stringify(step.args ?? {}, null, 2)}
										</pre>
										{unreadableArgsIndices?.has(index) && (
											<p className="mt-1 text-xs text-destructive">
												Recorded arguments could not be read -- shown as
												empty and ignored, not a genuine no-args call.
											</p>
										)}
										<Select
											value={step.argsMatch ?? "exact"}
											onValueChange={(value) =>
												update(index, { argsMatch: value as ArgsMatch })
											}
										>
											<SelectTrigger className="mt-1 w-64">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="exact">
													Arguments must match exactly
												</SelectItem>
												<SelectItem value="subset">
													Only these keys must match
												</SelectItem>
												<SelectItem value="ignore">
													Ignore arguments
												</SelectItem>
											</SelectContent>
										</Select>
									</>
								) : (
									<div className="whitespace-pre-wrap">{step.text}</div>
								)}
							</div>
						</div>
					))}
				</div>

				{enabledCount === 0 && (
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
						disabled={saving || enabledCount === 0}
					>
						{saving ? "Creating..." : "Create testcase"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
