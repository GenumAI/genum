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
 * Rewrites the LAST final step's text, which for a trajectory testcase IS the expected
 * answer the author is looking at: the expected-output editor beside the panel shows the
 * session's answer, which is the answer to the last question asked. Targeting the first
 * final would silently edit a turn the author is not looking at.
 *
 * `enabled` is deliberately not part of the search -- the author is editing the answer
 * they can see, and the server decides separately which final `expectedOutput` follows
 * (the last ENABLED final), because an unticked final is excluded from the assertion and
 * must not become the testcase's expected answer.
 *
 * A trajectory whose last turn still asked for a tool has no final step, and that is a
 * legitimate recording -- the steps come back untouched rather than gaining an assertion
 * the author never pinned.
 *
 * A reverse loop rather than `findLastIndex`: apps/web targets ES2020, where that method
 * is not in the lib, and web's vitest does not typecheck -- the error would surface only
 * in `pnpm --filter web build`.
 */
export function withFinalText(steps: Step[], text: string): Step[] {
	let finalIndex = -1;
	for (let i = steps.length - 1; i >= 0; i--) {
		if (steps[i].kind === "final") {
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
