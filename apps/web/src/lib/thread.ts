import { effectiveSteps, turnsOf } from "@/lib/session";
import type { Step } from "@/types/steps";

/** Real, measured usage for one turn. Absent is meaningful -- see `ThreadMessage`. */
export interface ThreadMetrics {
	tokens: number;
	cost: number;
	responseTimeMs: number;
}

export type ThreadOutcome = "matched" | "mismatched" | "not-asserted" | "not-reached";

/**
 * One row of the thread. The two adapters below both produce this, and nothing downstream
 * knows which adapter it came from -- that is the point: the live run and the saved
 * testcase drifted apart precisely because they were rendered by two components that
 * shared no shape.
 */
export interface ThreadMessage {
	step: Step;
	/**
	 * The step's FLAT index in the trajectory. Every save, every mismatch and every
	 * enable/disable addresses a step by this. A turn-local index would silently write to
	 * the wrong step.
	 */
	index: number;
	/**
	 * What the last run actually produced for this answer, paired per D4. Absent when the
	 * run never reached this turn, and on every live message (the live thread IS what was
	 * produced -- there is nothing to compare it against yet).
	 */
	produced?: string;
	/**
	 * Present ONLY where the usage was measured. A recorded trajectory has none: the span
	 * rows store zeros as placeholders keeping the OTel-shaped schema intact, not as
	 * measurements. Rendering those would tell the author the turn cost nothing.
	 */
	metrics?: ThreadMetrics;
	/** Absent means "nothing to report", not "passed". */
	outcome?: ThreadOutcome;
	outcomeReason?: string;
}

/**
 * The index one past the last live step. `effectiveSteps` slices UP TO but NOT INCLUDING
 * the unticked reply that ends the session, so its length is that reply's own flat index.
 * The reply itself stays live -- it is the control that made the cut, and unticking it is
 * how the cut gets undone -- so only steps STRICTLY after it are unreachable.
 */
function cutIndexOf(steps: Step[]): number {
	return effectiveSteps(steps).length;
}

/**
 * D4: pair produced with expected BY TURN ORDINAL, which is what `compareSteps` does
 * (`expectedTurns.forEach((turn, index) => actualTurns[index] ...)`). Pairing by flat
 * index looks equivalent on a tidy example and diverges the moment a turn's step counts
 * differ -- and then the thread shows text that contradicts the badge beside it, with no
 * way for the author to tell which is wrong.
 */
function producedFinalsByTurn(lastSteps: Step[]): (string | undefined)[] {
	return turnsOf(lastSteps).map((turn) => {
		for (const step of turn.steps) {
			if (step.kind === "final") return step.text;
		}
		return undefined;
	});
}

export function testcaseThread(params: {
	expectedSteps: Step[];
	lastSteps: Step[];
	mismatches: Map<number, string>;
	comparisonRecorded: boolean;
}): ThreadMessage[] {
	const { expectedSteps, lastSteps, mismatches, comparisonRecorded } = params;
	const cutIndex = cutIndexOf(expectedSteps);
	const produced = producedFinalsByTurn(lastSteps);

	const messages: ThreadMessage[] = [];
	turnsOf(expectedSteps).forEach((turn, turnPosition) => {
		turn.steps.forEach((step, position) => {
			const index = turn.start + position;
			const dead = index > cutIndex;
			const reason = mismatches.get(index);

			// Copied deliberately from TrajectoryPanel rather than restated: a reply is
			// never compared (`compareSteps` filters replies out of both sides), so it can
			// carry no comparison outcome -- without this it fell through to a green
			// "matched" off a comparison that never looked at it. "not-reached" is
			// different: that is a fact about the session, not about a comparison.
			const outcome: ThreadOutcome | undefined = dead
				? "not-reached"
				: step.kind === "user"
					? undefined
					: !comparisonRecorded
						? undefined
						: step.enabled === false
							? "not-asserted"
							: reason
								? "mismatched"
								: "matched";

			const producedText = step.kind === "final" ? produced[turnPosition] : undefined;

			messages.push({
				step,
				index,
				...(producedText !== undefined ? { produced: producedText } : {}),
				...(outcome ? { outcome } : {}),
				...(outcome === "mismatched" && reason ? { outcomeReason: reason } : {}),
			});
		});
	});
	return messages;
}

export function liveThread(params: {
	steps: Step[];
	/**
	 * One entry per turn, in turn order. Short arrays are fine: a turn with no entry
	 * simply carries no metrics.
	 */
	metricsByTurn: (ThreadMetrics | undefined)[];
}): ThreadMessage[] {
	const { steps, metricsByTurn } = params;
	const messages: ThreadMessage[] = [];
	turnsOf(steps).forEach((turn, turnPosition) => {
		turn.steps.forEach((step, position) => {
			const metrics = step.kind === "final" ? metricsByTurn[turnPosition] : undefined;
			messages.push({
				step,
				index: turn.start + position,
				...(metrics ? { metrics } : {}),
			});
		});
	});
	return messages;
}

/**
 * D3. A follow-up only makes sense once the model has finished answering: nothing in
 * flight, no tool still waiting on a result, and the thread ends on an answer. Extracted
 * from `TrajectorySteps` so the rule is testable -- inside a component it was not.
 */
export function canAddMessage(params: {
	steps: Step[];
	pendingTool: string | null;
	isRunning: boolean;
}): boolean {
	const { steps, pendingTool, isRunning } = params;
	if (isRunning || pendingTool) return false;
	const last = steps[steps.length - 1];
	return last?.kind === "final";
}
