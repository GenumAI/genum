# Conversation Thread Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three components that each render the same conversation with one `ConversationThread`, in which every model answer carries its own expected text, verdict and "save as expected".

**Architecture:** Every rule that can be got wrong moves into a pure function under `apps/web/src/lib/` where a test can reach it; the components stay thin and are verified by `pnpm --filter web build` and by eye. Two adapters normalize the live playground run and the saved testcase into one `ThreadMessage[]`, so the two sources cannot drift.

**Tech Stack:** React 18, TypeScript, Vite, TanStack Query, Zustand, Radix UI, Vitest (node environment), Biome.

**Spec:** `docs/superpowers/specs/2026-09-09-conversation-thread-design.md` — read it before Task 1. Its D1-D8 are binding; this plan argues from them.

## Global Constraints

- `apps/web`'s vitest runs with `environment: "node"` and has **no jsdom and no testing-library**. Do not add either — it is out of scope. Components cannot be unit-tested; put every testable rule in a pure module and test that.
- `apps/web`'s vitest does **not** typecheck. `pnpm --filter web build` is the only thing that does. Run it on every task.
- `apps/web` targets **ES2020**: no `findLast`, no `findLastIndex`, no `.at()`.
- `apps/web` does **not** depend on `apps/core`. `types/steps.ts`, `types/spans.ts` and `lib/session.ts` are hand-restated mirrors; do not import across the boundary and do not change the mirrored bodies.
- **No backend change.** The server already cascades `expectedOutput` from `expectedSteps` (`apps/core/src/controllers/testcase.controller.ts:101` and `:163`). If a task seems to need a core change, stop and report — it means the task was misread.
- The stored step discriminator stays `"final"`. It is persisted inside `expectedSteps` and `lastSteps` JSON on every existing testcase. Copy may say "answer"; the value may not change.
- Biome: tabs, indent width 4, line width 100, LF. Lint and format are red repo-wide; judge only the files you touch. Format your own changed files — no pre-commit hook runs.
- Run web tests through turbo: `pnpm turbo run test:run --filter=web`.
- A test that passes against the implementation it claims to exclude guards nothing. Where you add a test, confirm it fails first, against the wrong implementation named in the task.
- The `Input` block above the thread is **out of scope** and is not touched.

## Baseline

At `3be3fca`: core **738 tests / 70 files**, web **63 tests / 4 files**, both green; `pnpm --filter web build` succeeds. Your counts must be higher and everything must pass.

## File Structure

**Created**
- `apps/web/src/lib/thread.ts` — `ThreadMessage`, the two adapters, `canAddMessage`. All pure.
- `apps/web/src/lib/thread.test.ts`
- `apps/web/src/lib/expectedSave.ts` — where a saved expected answer is written (D6/D7). Pure.
- `apps/web/src/lib/expectedSave.test.ts`
- `apps/web/src/components/thread/ThreadMessageRow.tsx` — one message.
- `apps/web/src/components/thread/ConversationThread.tsx` — turns, header, `+ Add message`.
- `apps/web/src/components/thread/CompareDialog.tsx` — one turn's produced vs expected, fullscreen Monaco.

**Modified**
- `apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/Output.tsx` — body becomes the thread; keeps the assertion header, the actions and the step picker.
- `apps/web/src/pages/prompt/playground-tabs/playground/Playground.tsx` — stops rendering the two old surfaces; passes the live trajectory and the testcase into `OutputBlock`.

**Deleted**
- `apps/web/src/pages/prompt/playground-tabs/components/TrajectorySteps.tsx`
- `apps/web/src/pages/prompt/playground-tabs/components/TrajectoryPanel.tsx`
- `apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/components/ExpandedOutputDialog.tsx` (replaced by `CompareDialog`)
- `apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/components/MetricsDisplay.tsx`

---

### Task 1: The thread model and its two adapters

**Files:**
- Create: `apps/web/src/lib/thread.ts`
- Test: `apps/web/src/lib/thread.test.ts`

**Interfaces:**
- Consumes: `Step`, `Turn` from `@/types/steps`; `effectiveSteps`, `turnsOf` from `@/lib/session`; `mismatchByIndex`, `hasStepComparison` from wherever `useTestcaseTrajectory` imports them today (read that file's imports and reuse, do not reimplement).
- Produces: `ThreadMessage`, `ThreadMetrics`, `liveThread`, `testcaseThread`, `canAddMessage`.

This task is pure logic and carries the whole risk of D4 and D5. Nothing renders yet.

- [ ] **Step 1: Read the two sources you are unifying**

Read, and do not skip — the outcome rules below are copied from the first, and getting them from memory instead is how the marks start disagreeing with the verdict:

- `apps/web/src/pages/prompt/playground-tabs/components/TrajectoryPanel.tsx` (the `rows` map: `dead`, `outcome`, `cutIndex`)
- `apps/web/src/pages/prompt/playground-tabs/playground/hooks/useTestcaseTrajectory.ts` (what a testcase gives you: `steps`, `mismatchByIndex`, `comparisonRecorded`, `hasRun`)
- `apps/core/src/ai/steps/compare.ts:142-175` (`compareSteps` — the pairing D4 must match, read-only, do not edit)

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { canAddMessage, liveThread, testcaseThread } from "./thread";
import type { Step } from "@/types/steps";

const TWO_TURNS: Step[] = [
	{ kind: "final", text: "expected one" },
	{ kind: "user", text: "and then?" },
	{ kind: "final", text: "expected two" },
];

describe("testcaseThread", () => {
	it("pairs each turn's produced answer with THAT turn's expected answer", () => {
		// The discriminating case for D4. Pairing by flat index would hand turn 2's
		// expected the text at actual[2] -- which here is turn 2's final only by luck.
		// The actual run below has an extra tool call in turn 1, so flat indices no
		// longer line up and only turn-ordinal pairing gets it right.
		const messages = testcaseThread({
			expectedSteps: TWO_TURNS,
			lastSteps: [
				{ kind: "tool_call", name: "lookup", args: {} },
				{ kind: "final", text: "produced one" },
				{ kind: "user", text: "and then?" },
				{ kind: "final", text: "produced two" },
			],
			mismatches: new Map(),
			comparisonRecorded: true,
		});

		const finals = messages.filter((message) => message.step.kind === "final");
		expect(finals.map((message) => message.produced)).toEqual([
			"produced one",
			"produced two",
		]);
	});

	it("carries no metrics at all, never zeros", () => {
		// D5. A recorded trajectory's spans store zeros as placeholders. Rendering them
		// would state that the turn cost nothing and took no time.
		const messages = testcaseThread({
			expectedSteps: TWO_TURNS,
			lastSteps: [],
			mismatches: new Map(),
			comparisonRecorded: false,
		});
		expect(messages.every((message) => message.metrics === undefined)).toBe(true);
	});

	it("reports no outcome when no comparison was recorded", () => {
		const messages = testcaseThread({
			expectedSteps: TWO_TURNS,
			lastSteps: [],
			mismatches: new Map(),
			comparisonRecorded: false,
		});
		expect(messages.every((message) => message.outcome === undefined)).toBe(true);
	});

	it("marks steps after an unticked reply as not-reached, and the reply itself live", () => {
		const cut: Step[] = [
			{ kind: "final", text: "one" },
			{ kind: "user", text: "stop here", enabled: false },
			{ kind: "final", text: "two" },
		];
		const messages = testcaseThread({
			expectedSteps: cut,
			lastSteps: [],
			mismatches: new Map(),
			comparisonRecorded: true,
		});
		// The unticked reply is the live control that made the cut -- it must not read as
		// dead, or there is no way to undo the cut from the thread.
		expect(messages[1].outcome).toBeUndefined();
		expect(messages[2].outcome).toBe("not-reached");
	});

	it("never reports an outcome for a user reply", () => {
		// `compareSteps` filters replies out of both sides, so no comparison outcome can
		// exist for one; without this it fell through to a green "matched".
		const messages = testcaseThread({
			expectedSteps: TWO_TURNS,
			lastSteps: TWO_TURNS,
			mismatches: new Map(),
			comparisonRecorded: true,
		});
		expect(messages[1].step.kind).toBe("user");
		expect(messages[1].outcome).toBeUndefined();
	});

	it("marks an unticked step not-asserted rather than matched", () => {
		const messages = testcaseThread({
			expectedSteps: [{ kind: "final", text: "one", enabled: false }],
			lastSteps: [{ kind: "final", text: "one" }],
			mismatches: new Map(),
			comparisonRecorded: true,
		});
		expect(messages[0].outcome).toBe("not-asserted");
	});

	it("addresses every message by its FLAT index, which mismatches are keyed by", () => {
		const messages = testcaseThread({
			expectedSteps: TWO_TURNS,
			lastSteps: TWO_TURNS,
			mismatches: new Map([[2, "text differs"]]),
			comparisonRecorded: true,
		});
		expect(messages.map((message) => message.index)).toEqual([0, 1, 2]);
		expect(messages[2].outcome).toBe("mismatched");
		expect(messages[2].outcomeReason).toBe("text differs");
	});
});

describe("liveThread", () => {
	it("puts the run's metrics on the answer it measured", () => {
		// D5's other half: in the playground each turn HAS a response, so its metrics are
		// real and belong on that message.
		const messages = liveThread({
			steps: [{ kind: "final", text: "hi" }],
			metricsByTurn: [{ tokens: 98, cost: 0, responseTimeMs: 3218 }],
		});
		expect(messages[0].metrics).toEqual({ tokens: 98, cost: 0, responseTimeMs: 3218 });
	});

	it("produces the same message shape as a testcase thread", () => {
		// The two adapters exist so the thread component sees one shape. A field one
		// adapter sets and the other silently omits is how the two surfaces drift apart
		// again -- which is the whole defect this work removes.
		const live = liveThread({ steps: TWO_TURNS, metricsByTurn: [] });
		const saved = testcaseThread({
			expectedSteps: TWO_TURNS,
			lastSteps: [],
			mismatches: new Map(),
			comparisonRecorded: false,
		});
		expect(live.map((m) => m.index)).toEqual(saved.map((m) => m.index));
		expect(live.map((m) => m.step.kind)).toEqual(saved.map((m) => m.step.kind));
	});

	it("reports no outcome for a live run: nothing has been compared", () => {
		const messages = liveThread({ steps: TWO_TURNS, metricsByTurn: [] });
		expect(messages.every((message) => message.outcome === undefined)).toBe(true);
	});
});

describe("canAddMessage", () => {
	it("allows a follow-up once the model has answered", () => {
		expect(
			canAddMessage({
				steps: [{ kind: "final", text: "done" }],
				pendingTool: null,
				isRunning: false,
			}),
		).toBe(true);
	});

	it("refuses while a tool is waiting for its result", () => {
		expect(
			canAddMessage({
				steps: [{ kind: "final", text: "done" }],
				pendingTool: "get_weather",
				isRunning: false,
			}),
		).toBe(false);
	});

	it("refuses while a turn is in flight", () => {
		expect(
			canAddMessage({
				steps: [{ kind: "final", text: "done" }],
				pendingTool: null,
				isRunning: true,
			}),
		).toBe(false);
	});

	it("refuses when the last step is not an answer", () => {
		expect(
			canAddMessage({
				steps: [{ kind: "tool_call", name: "t", args: {} }],
				pendingTool: null,
				isRunning: false,
			}),
		).toBe(false);
	});

	it("refuses on an empty thread", () => {
		expect(canAddMessage({ steps: [], pendingTool: null, isRunning: false })).toBe(false);
	});
});
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `pnpm turbo run test:run --filter=web`
Expected: FAIL — `./thread` does not resolve.

- [ ] **Step 4: Implement `thread.ts`**

```ts
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

			messages.push({
				step,
				index,
				...(step.kind === "final" && produced[turnPosition] !== undefined
					? { produced: produced[turnPosition] }
					: {}),
				...(outcome ? { outcome } : {}),
				...(outcome === "mismatched" && reason ? { outcomeReason: reason } : {}),
			});
		});
	});
	return messages;
}

export function liveThread(params: {
	steps: Step[];
	/** One entry per turn, in turn order. Short arrays are fine: a turn with no entry
	 *  simply carries no metrics. */
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
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm turbo run test:run --filter=web`
Expected: PASS, web count up by 14.

- [ ] **Step 6: Prove the D4 test discriminates**

Temporarily change `producedFinalsByTurn` pairing to flat index — make `testcaseThread` read `lastSteps[index]?.text` for a final instead of the per-turn value. Re-run. The first test MUST fail. Restore the correct implementation and re-run. Report both outcomes in your report.

- [ ] **Step 7: Format and commit**

```bash
npx biome format --write apps/web/src/lib/thread.ts apps/web/src/lib/thread.test.ts
git add apps/web/src/lib/thread.ts apps/web/src/lib/thread.test.ts
git commit -m "feat(thread): one message model for the live run and the saved testcase"
```

---

### Task 2: Where a saved expected answer is written

**Files:**
- Create: `apps/web/src/lib/expectedSave.ts`
- Test: `apps/web/src/lib/expectedSave.test.ts`

**Interfaces:**
- Consumes: nothing but its own parameters. Deliberately: this is the one rule in the feature that must be decidable without a React tree.
- Produces: `ExpectedSave`, `expectedSaveFor`.

This task implements D6, the trap. Read D6 in the spec before writing a line.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { expectedSaveFor } from "./expectedSave";

describe("expectedSaveFor", () => {
	it("writes expectedOutput DIRECTLY for a testcase that has no trajectory", () => {
		// D6, and the reason this module exists. A text testcase is compared through
		// `expectedOutput` and its assertion; one with an `expectedSteps` array is
		// compared through `compareSteps`. Synthesizing a one-element array here -- the
		// tempting way to make the thread uniform -- silently moves the testcase onto a
		// different comparison and changes its verdict with no author action.
		const save = expectedSaveFor({
			hasTestcase: true,
			hasTrajectory: false,
			index: 0,
			text: "the expected answer",
		});
		expect(save).toEqual({ kind: "expectedOutput", answer: "the expected answer" });
	});

	it("never produces expectedSteps for a testcase that has no trajectory", () => {
		// Stated separately and negatively: this is the assertion that fails against the
		// wrong implementation even if its shape changes.
		const save = expectedSaveFor({
			hasTestcase: true,
			hasTrajectory: false,
			index: 0,
			text: "x",
		});
		expect(save.kind).not.toBe("expectedSteps");
	});

	it("writes the addressed step for a testcase that has a trajectory", () => {
		const save = expectedSaveFor({
			hasTestcase: true,
			hasTrajectory: true,
			index: 2,
			text: "turn two's answer",
		});
		expect(save).toEqual({ kind: "expectedSteps", index: 2, text: "turn two's answer" });
	});

	it("keeps the edit local when there is no testcase to write to", () => {
		// D7. Nothing is written per keystroke to a testcase that does not exist; `Add
		// testcase` materializes the thread.
		const save = expectedSaveFor({
			hasTestcase: false,
			hasTrajectory: false,
			index: 0,
			text: "draft",
		});
		expect(save).toEqual({ kind: "draft", text: "draft" });
	});

	it("keeps the edit local without a testcase even when steps were recorded", () => {
		const save = expectedSaveFor({
			hasTestcase: false,
			hasTrajectory: true,
			index: 1,
			text: "draft",
		});
		expect(save.kind).toBe("draft");
	});
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm turbo run test:run --filter=web`
Expected: FAIL — `./expectedSave` does not resolve.

- [ ] **Step 3: Implement `expectedSave.ts`**

```ts
/**
 * Where one message's expected answer goes when the author saves it.
 *
 * This is a pure decision and not a hook on purpose. It encodes D6, which is the single
 * way this redesign can silently corrupt existing testcases, and a rule that can only be
 * exercised through a rendered component is a rule nothing in this repo can test: web's
 * vitest runs in `environment: "node"` with no jsdom.
 */
export type ExpectedSave =
	| { kind: "expectedOutput"; answer: string }
	| { kind: "expectedSteps"; index: number; text: string }
	| { kind: "draft"; text: string };

export function expectedSaveFor(params: {
	/** A testcase is selected, so there is somewhere durable to write. */
	hasTestcase: boolean;
	/** The testcase's `expectedSteps` is a non-empty array. */
	hasTrajectory: boolean;
	/** The message's flat index in the trajectory. */
	index: number;
	text: string;
}): ExpectedSave {
	const { hasTestcase, hasTrajectory, index, text } = params;

	// D7: no testcase, no write. The thread is a draft until `Add testcase` materializes
	// the whole of it at once.
	if (!hasTestcase) return { kind: "draft", text };

	// D6: a text testcase stays a text testcase. Its expected answer is a column, not a
	// step, and giving it a one-element `expectedSteps` array would move it onto
	// trajectory comparison behind the author's back.
	if (!hasTrajectory) return { kind: "expectedOutput", answer: text };

	return { kind: "expectedSteps", index, text };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm turbo run test:run --filter=web`
Expected: PASS, web count up by 5.

- [ ] **Step 5: Prove the D6 test discriminates**

Temporarily make the `!hasTrajectory` branch return `{ kind: "expectedSteps", index, text }`. Re-run: the first two tests MUST fail. Restore and re-run. Report both outcomes.

- [ ] **Step 6: Format and commit**

```bash
npx biome format --write apps/web/src/lib/expectedSave.ts apps/web/src/lib/expectedSave.test.ts
git add apps/web/src/lib/expectedSave.ts apps/web/src/lib/expectedSave.test.ts
git commit -m "feat(thread): route a saved expected answer without converting a text testcase"
```

---

### Task 3: The thread components

**Files:**
- Create: `apps/web/src/components/thread/ThreadMessageRow.tsx`
- Create: `apps/web/src/components/thread/ConversationThread.tsx`
- Read for reference: `apps/web/src/components/steps/StepRow.tsx`, `apps/web/src/components/steps/TurnSection.tsx`, `apps/web/src/pages/prompt/playground-tabs/components/TrajectorySteps.tsx`

**Interfaces:**
- Consumes: `ThreadMessage`, `canAddMessage` (Task 1); `Step` from `@/types/steps`; `TurnSection` from `@/components/steps/TurnSection`; existing `Button`, `Textarea`, `Card`, `Checkbox` from `@/components/ui/`.
- Produces: `<ThreadMessageRow>` and `<ConversationThread>` with the props listed below. Task 5 wires them.

No tests: components cannot be unit-tested here (see Global Constraints). The gate is `pnpm --filter web build` plus the reviewer reading the diff against the spec.

- [ ] **Step 1: Read `StepRow.tsx` end to end**

`ThreadMessageRow` is `StepRow` grown up, not a replacement written from scratch. In particular reproduce, do not reinvent:
- the local draft buffered in state and committed on blur;
- the contract that `onTextChange` returns whether the write landed, and a `false` keeps the draft and leaves the field dirty so a later resync cannot overwrite the author's edit;
- the outcome badge and its labels;
- the `user` row being visibly labeled so the author can tell their own words from the model's.

- [ ] **Step 2: Write `ThreadMessageRow.tsx`**

Props:

```tsx
interface ThreadMessageRowProps {
	message: ThreadMessage;
	/** No editing, no checkbox, no save -- the logs tab's read-only rendering. */
	readOnly?: boolean;
	/** Absent for a live thread with no testcase: there is nothing to untick. */
	onEnabledChange?: (enabled: boolean) => void;
	/** `ArgsMatch` from `@/types/steps` -- THREE values: "exact" | "subset" | "ignore". */
	onArgsMatchChange?: (argsMatch: ArgsMatch) => void;
	/** Returns whether the write landed; `false` keeps the draft. */
	onExpectedChange?: (text: string) => boolean | undefined | Promise<boolean | undefined>;
	/** Copies `produced` into the expected field and saves it. */
	onSaveAsExpected?: () => void;
	/** Opens the fullscreen compare for this turn (Task 4). */
	onCompare?: () => void;
	disabled?: boolean;
}
```

Layout, in order, inside one card:

1. `tool_call` → name, pretty-printed args, recorded result. Unchanged from `StepRow`.
2. `user` → the "You" label and the text. Unchanged from `StepRow`.
3. `final` →
   - the produced text (`message.produced ?? step.text`), `text-sm`, `whitespace-pre-wrap`;
   - a metrics line, **rendered only when `message.metrics` is present** — tokens, cost, seconds, in the compact form `MetricsDisplay` uses today;
   - the outcome badge when `message.outcome` is set, with `outcomeReason` appended for a mismatch;
   - `Expected`, an editable textarea holding the expected text, **collapsed behind a "Set an expected answer" link when it is empty**, and shown expanded when it has content or differs from produced;
   - a right-aligned row: `Save as expected` (present only with `onSaveAsExpected`) and a `⛶` icon button (present only with `onCompare`).

Do not render a metrics line of zeros when `metrics` is absent. That is D5 and it is the point.

- [ ] **Step 3: Write `ConversationThread.tsx`**

Props:

```tsx
interface ConversationThreadProps {
	messages: ThreadMessage[];
	/** Live-run controls. Omit for a read-only or saved-testcase thread. */
	live?: {
		pendingTool: string | null;
		isRunning: boolean;
		onToolResult: (name: string, result: string) => void;
		onReply: (text: string) => void;
		error: string | null;
		onRetry: () => void;
	};
	orderMatters?: boolean;
	onOrderMattersChange?: (value: boolean) => void;
	lastRunAt?: string | null;
	hasRun?: boolean;
	readOnly?: boolean;
	onEnabledChange?: (index: number, enabled: boolean) => void;
	onArgsMatchChange?: (index: number, argsMatch: ArgsMatch) => void;
	onExpectedChange?: (index: number, text: string) => boolean | undefined | Promise<boolean | undefined>;
	onSaveAsExpected?: (index: number) => void;
	onCompare?: (index: number) => void;
}
```

Structure:

- Renders nothing at all (`return null`) when `messages` is empty. An empty frame is worse than no frame.
- Groups messages into turns by walking `messages` and starting a new group at every `user` step that is not the first message — the same rule as `turnsOf`, applied to the already-flattened list. Use `TurnSection` for each group, numbered from 1, passing the live and total step counts it already takes.
- Below the turns: the pending-tool card, the "Waiting for the model…" spinner and the turn-failed card with `Retry` — all three lifted from `TrajectorySteps` unchanged in behaviour, rendered only when `live` is given.
- The `Steps must happen in this order within a turn` checkbox, rendered only when `onOrderMattersChange` is given. Keep the existing copy verbatim — it says "within a turn" for a reason.
- Last: `+ Add message`.

`+ Add message` (D3): a single ghost/outline button, full width, shown only when `live` is given and `canAddMessage({ steps: messages.map((m) => m.step), pendingTool: live.pendingTool, isRunning: live.isRunning })` is true. Clicking it swaps the button for the reply card — textarea plus a `Continue` button disabled on an empty `.trim()`, submitting `onReply(reply.trim())` and collapsing back to the button. Keep the trim: untrimmed text pins surrounding whitespace into durable step text.

- [ ] **Step 4: Type-check**

Run: `pnpm --filter web build`
Expected: succeeds. This is the only thing that typechecks web — vitest does not.

- [ ] **Step 5: Format and commit**

```bash
npx biome format --write apps/web/src/components/thread/ThreadMessageRow.tsx apps/web/src/components/thread/ConversationThread.tsx
git add apps/web/src/components/thread/
git commit -m "feat(thread): one message row and one thread, replacing two step lists"
```

---

### Task 4: The per-turn compare dialog

**Files:**
- Create: `apps/web/src/components/thread/CompareDialog.tsx`
- Read for reference: `apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/components/ExpandedOutputDialog.tsx`

**Interfaces:**
- Consumes: `CompareDiffEditor` from `@/components/ui/DiffEditor`, the existing `Dialog` primitives.
- Produces: `<CompareDialog>`.

D2: this is the ONLY place Monaco mounts for output comparison. Nothing in the thread body may mount it.

- [ ] **Step 1: Read `ExpandedOutputDialog.tsx`**

It already does this for one hardcoded pair — the last answer against the single expected value. The work is generalizing its two operands to a turn, and dropping the parts that duplicate the thread (the metrics header, the `Add testcase` button: both live in the thread now).

- [ ] **Step 2: Write `CompareDialog.tsx`**

```tsx
interface CompareDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 1-based, for the title: "Turn 2 — produced vs expected". */
	turnNumber: number;
	/** What the run produced for this turn. Empty when the run never reached it. */
	produced: string;
	/** The expected answer for this turn. */
	expected: string;
	/** Commits an edit made inside the dialog. Absent makes the dialog read-only. */
	onExpectedChange?: (text: string) => void;
}
```

`original={produced}`, `modified={expected}`, same `surfaceToken` and class conventions as the existing dialog. Title names the turn — a dialog that says only "Output" is what made the old one feel like a second, competing surface.

- [ ] **Step 3: Type-check**

Run: `pnpm --filter web build`
Expected: succeeds.

- [ ] **Step 4: Format and commit**

```bash
npx biome format --write apps/web/src/components/thread/CompareDialog.tsx
git add apps/web/src/components/thread/CompareDialog.tsx
git commit -m "feat(thread): compare one turn's produced answer against its expected"
```

---

### Task 5: Wire it in and delete the three old surfaces

**Files:**
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/Output.tsx`
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/Playground.tsx`
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/hooks/useTestcaseTrajectory.ts` (only if the thread needs an accessor it does not already return)
- Delete: `apps/web/src/pages/prompt/playground-tabs/components/TrajectorySteps.tsx`
- Delete: `apps/web/src/pages/prompt/playground-tabs/components/TrajectoryPanel.tsx`
- Delete: `apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/components/ExpandedOutputDialog.tsx`
- Delete: `apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/components/MetricsDisplay.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: the finished feature.

This is the integration task and the one that can lose behaviour. Work through the list in Step 4 explicitly.

- [ ] **Step 1: Move the thread into `Output.tsx`**

`OutputBlock` stays the host — it already owns the assertion hooks, `useTestcaseActions`, the step picker and the clear-on-change effects, and moving those is churn this feature does not need. Replace its body only:

- Keep: `OutputHeader` (the assertion panel), `OutputActions`' `Add testcase`, `TestcaseStepPickerDialog`, both registration effects.
- Delete: the two-column `MetricsDisplay` grid, the `Card` holding `CompareDiffEditor`, and the `ExpandedOutputDialog` render.
- Add: `<ConversationThread>` built from the right adapter — `liveThread` when there is no testcase or the live trajectory is non-empty, `testcaseThread` when a testcase with `expectedSteps` is selected. State which you chose and why in a comment; a reader will ask.
- Route every expected save through `expectedSaveFor` (Task 2), dispatching its three kinds to: `useTestcaseTrajectory.setStepText`, the existing `onSaveAsExpected` (which writes `expectedOutput`), and local state.

- [ ] **Step 2: Simplify `Playground.tsx`**

Delete the `TrajectorySteps` render and the `TrajectoryPanel` render. Pass the live trajectory and `testcase.data` into `OutputBlock` instead. The comment above the old `TrajectorySteps` render explains that the trajectory must sit above, never in place of, the add-testcase affordances — that constraint is now satisfied by construction, since they are in the same component; say so where the comment used to be rather than deleting the knowledge.

- [ ] **Step 3: Delete the four files**

```bash
git rm apps/web/src/pages/prompt/playground-tabs/components/TrajectorySteps.tsx \
       apps/web/src/pages/prompt/playground-tabs/components/TrajectoryPanel.tsx \
       apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/components/ExpandedOutputDialog.tsx \
       apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/components/MetricsDisplay.tsx
```

Then `grep -rn "TrajectorySteps\|TrajectoryPanel\|ExpandedOutputDialog\|MetricsDisplay" apps/web/src` and fix every hit. `usePlaygroundTestcase.ts` referenced `TrajectoryPanel` at plan time — check what it actually needs.

- [ ] **Step 4: Collapse the two-writer race, deliberately and with its comments**

Found in the pre-flight scan, and the plan would have been wrong without it.
`usePlaygroundTestcase.ts:344-356` holds a **third** writer of `expectedSteps`: saving the
expected output also syncs the answer into the trajectory's final step via `withFinalText`,
guarded by `trajectoryWriteInFlight` (`:156`). The guard exists because two surfaces each sent
the WHOLE array, so a read-modify-write from one could revert an untick the author had just
made in the other — the comment says exactly that, and it is worth reading before you touch it.

Collapsing the surfaces removes the race at its source: after this task there is one writer.
That is a real simplification and it is yours to make, but make it on purpose:

- Decide whether `trajectoryWriteInFlight` and the `withFinalText` sync are still needed. If
  the thread routes every expected save through `expectedSaveFor` — one path, one array, one
  in-flight mutation — they are not, and keeping them means keeping a guard against a
  collision that can no longer happen.
- If you remove them, say in the commit message and your report WHY the race is gone. A future
  reader finding a deleted concurrency guard with no explanation will assume it was an
  oversight and put it back.
- If you keep them, say what still races. "It seemed safer" is not an answer — a guard nobody
  can justify is how the next person learns to distrust the comments.
- `withFinalText` stays in `lib/trajectoryEdits.ts` either way: it has its own tests and other
  callers may exist. Check with grep before assuming.

- [ ] **Step 5: Walk the survival list**

Each of these exists because something broke without it. Confirm each still holds, and say in your report how you confirmed it:

1. Expected clears when the prompt changes and no testcase is selected.
2. Expected and output clear when a testcase is deselected.
3. A rejected expected write keeps the author's draft and leaves the field dirty.
4. Unticking the last enabled step still raises the "the trajectory has to go with it" confirmation and, on confirm, removes the trajectory leaving a text testcase (`wouldEmptyTrajectory` + `removeTrajectory`).
5. `Add testcase` still opens the step picker when there is a trajectory to pick from.
6. The reply is refused while a tool is pending — now enforced by `canAddMessage`, which has a test.
7. A turn that failed still shows its message and a working `Retry`.

- [ ] **Step 6: Verify everything**

```
pnpm turbo run test:run --filter=web
pnpm --filter web build
pnpm turbo run test:run --filter=core
pnpm turbo run type-check --filter=core
```

All four green. Core must be untouched at 738/70 — if a core test moved, you changed something the spec put out of scope; stop and report.

- [ ] **Step 7: Format and commit**

```bash
npx biome format --write apps/web/src/pages/prompt/playground-tabs/playground/Playground.tsx apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/Output.tsx
git add -A
git commit -m "feat(playground): one conversation thread in place of three renderings of it"
```

---

## Self-review notes

- **Spec coverage:** D1 → Tasks 3+5. D2 → Task 4. D3 → `canAddMessage` (Task 1) + Task 3. D4 → Task 1, with a discriminating test and a proof step. D5 → Task 1 (`metrics` optional, tested absent) + Task 3 (no zero row). D6 → Task 2, with a discriminating test and a proof step. D7 → Task 2's `draft` kind. D8 → Task 5 keeps `OutputHeader`.
- **The `Input` block is deliberately untouched** in every task. It is the testcase's question, with its own files and placeholders; folding it into the thread is a separate redesign.
- **Two tasks carry a "prove it discriminates" step** (1 and 2) because both encode a rule whose wrong implementation looks correct on a tidy example. Neither may be skipped.
