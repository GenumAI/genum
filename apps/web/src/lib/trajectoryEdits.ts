import type { Step, StepMismatch, ToolCallStep } from "@/types/steps";

/** A patch an author can apply to one step from the panel. */
export type StepPatch = Partial<Pick<ToolCallStep, "enabled" | "argsMatch">>;

/**
 * Replaces one step, spreading the original so every field the author never sees --
 * `recordedResult` above all -- rides through. The picked steps are COPIED into the
 * testcase, and `recordedResult` is what lets it replay after the ClickHouse rows age out.
 */
export function withStepPatch(steps: Step[], index: number, patch: StepPatch): Step[] {
	return steps.map((step, i) => (i === index ? ({ ...step, ...patch } as Step) : step));
}

/**
 * `enabled` is optional and absent means enabled -- the same rule `compareSteps` applies.
 * Reading it as `=== true` would report a freshly-picked trajectory as asserting nothing.
 */
export function enabledCount(steps: Step[]): number {
	return steps.filter((step) => step.enabled !== false).length;
}

/**
 * Rewrites the final step's text, which for a trajectory testcase IS the expected answer:
 * the verdict comes from the step comparison and never reads `expectedOutput`.
 *
 * A trajectory whose last turn still asked for a tool has no final step, and that is a
 * legitimate recording -- the steps come back untouched rather than gaining an assertion
 * the author never pinned.
 */
export function withFinalText(steps: Step[], text: string): Step[] {
	const finalIndex = steps.findIndex((step) => step.kind === "final");
	if (finalIndex === -1) return steps;

	return steps.map((step, i) => (i === finalIndex ? { ...step, text } : step));
}

/**
 * `lastMismatches` is a `Json?` column, so what comes back is only as trustworthy as what
 * went in. A malformed entry is dropped rather than rendered, and a wholly malformed list
 * degrades to "no per-step marks" instead of breaking the panel.
 */
export function mismatchByIndex(
	mismatches: StepMismatch[] | null | undefined,
): Map<number, string> {
	const byIndex = new Map<number, string>();
	if (!Array.isArray(mismatches)) return byIndex;

	for (const mismatch of mismatches) {
		if (typeof mismatch?.index === "number" && typeof mismatch?.reason === "string") {
			byIndex.set(mismatch.index, mismatch.reason);
		}
	}
	return byIndex;
}

/**
 * Whether the last run actually compared the pinned steps -- the only thing that licenses
 * per-step marks. "Compared, everything passed" and "never compared" are different states
 * and only the first may render green: the server leaves `lastMismatches` null on three
 * live branches (a tool the recording does not cover, an AI assertion, a MANUAL one), and
 * the first of those is the headline NOK this feature exists to detect.
 *
 * `lastSteps` cannot answer this -- it is written on every trajectory run, compared or not.
 * An array is the wire signal for "compared", `[]` included (`Boolean([])` is true, so the
 * check is `Array.isArray`, never truthiness). A non-empty array none of whose entries
 * survive `mismatchByIndex` is unreadable rather than passing, and degrades to no marks --
 * the promise the JSDoc above makes.
 */
export function hasStepComparison(mismatches: StepMismatch[] | null | undefined): boolean {
	if (!Array.isArray(mismatches)) return false;
	return mismatches.length === 0 || mismatchByIndex(mismatches).size > 0;
}
