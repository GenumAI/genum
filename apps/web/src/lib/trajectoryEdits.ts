import { effectiveSteps } from "@/lib/session";
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
 *
 * Counts only comparable steps within `effectiveSteps`: a `user` reply is replayed
 * verbatim and never compared, so it never counts, and nothing past a truncation counts
 * either -- the session simply does not reach it.
 */
export function enabledCount(steps: Step[]): number {
	return effectiveSteps(steps).filter((step) => step.kind !== "user" && step.enabled !== false)
		.length;
}

/**
 * Rewrites the text of the final step the expected-output editor stands for, which for a
 * trajectory testcase IS the expected answer: the editor beside the panel shows the
 * session's answer, the answer to the last question the session actually asks.
 *
 * That step is the last ENABLED final of the EFFECTIVE list -- the same one the server
 * derives `expectedOutput` from (`lastEnabledFinal` in apps/core/src/ai/steps/session.ts).
 * It has to be the same one: the client sends both this array and `expectedOutput`, and
 * the server recomputes `expectedOutput` from the array afterwards. Writing the author's
 * new answer into the literal last final instead put it in a turn the session never
 * reaches, the server recomputed the old text back over it, and the box reverted on the
 * next refetch with nothing reported. The rule stated on this side and the rule stated on
 * the server's must not drift; if one changes, so does the other.
 *
 * The cut comes from `effectiveSteps` -- never re-derived here -- and the indices of that
 * prefix are the indices of the full array, so the rewrite can be applied in place.
 *
 * A trajectory whose live part has no enabled final -- the last live turn still asked for
 * a tool, or every final is unticked -- comes back untouched rather than gaining an
 * assertion the author never pinned. The server leaves `expectedOutput` alone in exactly
 * the same case.
 *
 * A reverse loop rather than `findLastIndex`: apps/web targets ES2020, where that method
 * is not in the lib, and web's vitest does not typecheck -- the error would surface only
 * in `pnpm --filter web build`.
 */
export function withFinalText(steps: Step[], text: string): Step[] {
	const live = effectiveSteps(steps);
	let finalIndex = -1;
	for (let i = live.length - 1; i >= 0; i--) {
		const step = live[i];
		if (step.kind === "final" && step.enabled !== false) {
			finalIndex = i;
			break;
		}
	}
	if (finalIndex === -1) return steps;

	return steps.map((step, i) => (i === finalIndex ? { ...step, text } : step));
}

function isStepMismatch(mismatch: StepMismatch | undefined): boolean {
	return typeof mismatch?.index === "number" && typeof mismatch?.reason === "string";
}

/**
 * `lastMismatches` is a `Json?` column, so what comes back is only as trustworthy as what
 * went in. A malformed entry is dropped rather than rendered, and a list any of whose
 * entries is malformed licenses no marks at all -- see `hasStepComparison`.
 */
export function mismatchByIndex(
	mismatches: StepMismatch[] | null | undefined,
): Map<number, string> {
	const byIndex = new Map<number, string>();
	if (!Array.isArray(mismatches)) return byIndex;

	for (const mismatch of mismatches) {
		if (isStepMismatch(mismatch)) {
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
 * check is `Array.isArray`, never truthiness).
 *
 * The list must be readable in full, not merely in part. If one entry is malformed, the
 * step it named is the step that failed, and dropping it renders that step green off an
 * entry we could not read -- the same mistake as treating "never compared" as "passed",
 * one step down. Counting readable entries rather than the map's size is deliberate: a
 * list that names the same index twice would shrink the map below its own length and be
 * misread as unreadable.
 */
export function hasStepComparison(mismatches: StepMismatch[] | null | undefined): boolean {
	if (!Array.isArray(mismatches)) return false;
	return mismatches.every(isStepMismatch);
}
