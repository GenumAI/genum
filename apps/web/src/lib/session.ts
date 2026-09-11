// Restated from apps/core/src/ai/steps/session.ts, not imported -- apps/web does not
// depend on apps/core, the same reason the step shapes are restated in `types/steps.ts`.
// Bodies must stay identical to the original: a divergence here is a bug that no test in
// either package would catch.

import type { FinalStep, Step, Turn } from "@/types/steps";

/**
 * The session as it actually runs. Unticking a user reply ends the session there, so
 * that reply and everything after it are dropped.
 *
 * The cut is made HERE and nowhere else. Replay, comparison, the step budget and
 * `hasEnabledStep` all consume this function's output, so none of them can disagree
 * about where the session ends -- a disagreement between two of them is how a testcase
 * ends up asserting steps it never reaches.
 *
 * Returns the input array itself when nothing is cut, so callers can use reference
 * identity to skip needless work.
 */
export function effectiveSteps(steps: Step[]): Step[] {
	const cut = steps.findIndex((step) => step.kind === "user" && step.enabled === false);
	return cut === -1 ? steps : steps.slice(0, cut);
}

/**
 * The final the session actually ends on: the last ENABLED `final` of the EFFECTIVE
 * list. This is the one `expectedOutput` mirrors (decision 7), and it is derived here so
 * that create and update cannot disagree -- a copy of the rule on the create path is
 * exactly how a testcase ends up pinning an answer from a turn it never reaches.
 *
 * Returns undefined when the session ends without an enabled final (a truncated session
 * whose last live turn still asked for a tool, or one whose finals are all unticked).
 * Callers must leave `expectedOutput` alone in that case: it is a non-nullable column,
 * and blanking it would make the plain-text testcase underneath assert an empty answer.
 */
export function lastEnabledFinal(steps: Step[]): FinalStep | undefined {
	const effective = effectiveSteps(steps);
	for (let index = effective.length - 1; index >= 0; index--) {
		const step = effective[index];
		if (step.kind === "final" && step.enabled !== false) {
			return step;
		}
	}
	return undefined;
}

/**
 * Splits a session into turns. A turn begins at each user reply; the first turn has no
 * reply of its own because its question is the testcase's `input`.
 *
 * `start` is the turn's first index in the FLAT array, because that is what mismatch
 * indices address -- per-turn matching must still report a flat index or every
 * index-addressed consumer downstream breaks.
 */
export function turnsOf(steps: Step[]): Turn[] {
	const turns: Turn[] = [];
	let current: Step[] = [];
	let start = 0;

	steps.forEach((step, index) => {
		if (step.kind === "user" && current.length > 0) {
			turns.push({ start, steps: current });
			current = [];
			start = index;
		}
		current.push(step);
	});

	if (current.length > 0) {
		turns.push({ start, steps: current });
	}
	return turns;
}
