# Trajectory Testcase Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a trajectory testcase visible and editable — see its pinned steps, see which of them the last run matched, change what is asserted, and remove the trajectory entirely.

**Architecture:** The server keeps deciding correctness and now persists the structured result (`lastMismatches`) that `compareSteps` already produces; the web renders that verdict rather than recomputing it. Editing persists per action, matching how the playground already saves a testcase. Clearing a trajectory is expressed as `expectedSteps: null`, which the repository maps to `Prisma.DbNull`.

**Tech Stack:** Node/Express/TypeScript, Prisma + PostgreSQL, ClickHouse, Zod, Vitest; React 18 + Vite, TanStack Query, Zustand, Radix primitives via `@/components/ui`, Phosphor icons, Biome.

**Spec:** [docs/superpowers/specs/2026-09-07-trajectory-testcase-screens-design.md](../specs/2026-09-07-trajectory-testcase-screens-design.md)

## Global Constraints

- A tool is NEVER executed by us. Recorded results are replayed.
- Trajectories are telemetry → ClickHouse (append-only). Pinned expectations are product data → PostgreSQL. Picked steps are COPIED into the testcase, never referenced; `recordedResult` must ride through every path untouched.
- Correctness is a chosen subset: `enabled` is optional on a `Step` and **absent means enabled**. Every predicate must read `enabled !== false`, never `=== true`.
- `Step` uses `kind`, not `type`. `ToolCallStep` has no `id`. Read `apps/core/src/ai/steps/types.ts` and its mirror `apps/web/src/types/steps.ts`.
- `EnabledStepsSchema` rejects an `expectedSteps` with no enabled step. The UI must never send one; it offers trajectory removal instead.
- `lastMismatches` is server-derived and is NOT writable through the update schema.
- Never edit `apps/core/src/.generated/`.
- ClickHouse is append-only and for AI run logs only. Transactional data goes to PostgreSQL via Prisma.
- Single `.env` at repo root — never create one in a subfolder.
- Biome: tabs, indent width 4, line width 100, LF. Lint is red on `main`; judge the delta on touched files only.
- `apps/web` has vitest (added in the previous branch) but no component testing. Test pure logic there; do not add a component test harness.
- Verify with `pnpm --filter web build`, `pnpm turbo run type-check --filter=core --force` (the `--force` is required — a cached pass once hid 12 type errors for two whole tasks), and `pnpm turbo run test:run --filter=core --filter=web`.

---

### Task 1: the data model can express a cleared trajectory

**Files:**
- Modify: `apps/core/prisma/models/testcase.prisma`
- Create: `apps/core/prisma/migrations/<generated>/migration.sql` (via `db:migrate:dev`)
- Modify: `apps/core/src/database/repositories/TestcasesRepository.ts:11-31` and its `updateTestcase` destructuring (~line 139)
- Modify: `apps/core/src/services/validate/types/testcase.type.ts` (the `expectedSteps` / `stepsConfig` fields of `TestcasesUpdateSchema`)
- Modify: `apps/core/src/controllers/testcase.controller.ts` (the update handler)
- Test: `apps/core/src/database/repositories/TestcasesRepository.test.ts` (create if absent)
- Test: `apps/core/src/services/validate/types/testcase.type.test.ts` (exists)
- Test: `apps/core/src/controllers/testcase.controller.test.ts` (exists)

**Interfaces:**
- Produces: `TestCase.lastMismatches: Json?`; `trajectoryColumns(data)` accepting `null` for `expectedSteps` / `stepsConfig` / `lastMismatches` and emitting `Prisma.DbNull`; `TestcasesUpdateSchema` accepting `expectedSteps: null` and `stepsConfig: null`.
- Consumes: nothing from later tasks.

Two things that must land together. Clearing a trajectory is the limitation the previous branch recorded and could not fix: `trajectoryColumns` skips `undefined` and casts everything else to `Prisma.InputJsonValue`, but a JSON column is set to SQL NULL only by `Prisma.DbNull`, and `null` cast to `InputJsonValue` is rejected at runtime. And the `lastMismatches` column Task 2 fills has to exist before `trajectoryColumns` can name it — a helper declaring a key Prisma's `UpdateInput` does not have fails type-check the moment its result is spread into `data`.

- [ ] **Step 1: Add the column**

In `apps/core/prisma/models/testcase.prisma`, beside the existing trajectory columns:

```prisma
    expectedSteps           Json?
    lastSteps               Json?
    stepsConfig             Json?

    // What `compareSteps` returned on the last run: `StepMismatch[]`, indices into
    // `expectedSteps`. Derived from a run, never sent by a client. Null when the testcase
    // has no trajectory, or has one that has not been run since.
    lastMismatches          Json?
```

- [ ] **Step 2: Generate and apply the migration**

```bash
pnpm --filter core db:migrate:dev --name testcase_last_mismatches
```

Expected: one additive migration adding a nullable column. Read the generated SQL and confirm it is a single `ADD COLUMN` with no default backfill and no table rewrite; paste it into your report.

- [ ] **Step 3: Write the failing repository test**

Create `apps/core/src/database/repositories/TestcasesRepository.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { Prisma } from "@/prisma";
import { trajectoryColumns } from "./TestcasesRepository";

describe("trajectoryColumns", () => {
	it("omits a field the caller did not mention", () => {
		expect(trajectoryColumns({})).toEqual({});
	});

	it("passes a value through unchanged", () => {
		const steps = [{ kind: "tool_call", name: "search" }];
		expect(trajectoryColumns({ expectedSteps: steps })).toEqual({ expectedSteps: steps });
	});

	it("maps null to Prisma.DbNull so the column becomes SQL NULL", () => {
		// `null` cast to InputJsonValue is rejected by Prisma at runtime; DbNull is the
		// only way to clear a Json? column, and clearing it is how a trajectory testcase
		// becomes a text one again.
		expect(trajectoryColumns({ expectedSteps: null })).toEqual({
			expectedSteps: Prisma.DbNull,
		});
	});

	it("maps every trajectory column independently", () => {
		expect(
			trajectoryColumns({ expectedSteps: null, lastSteps: [], stepsConfig: null }),
		).toEqual({
			expectedSteps: Prisma.DbNull,
			lastSteps: [],
			stepsConfig: Prisma.DbNull,
		});
	});
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL — `trajectoryColumns` is not exported, and the DbNull cases would return `{ expectedSteps: null }`.

- [ ] **Step 5: Make `trajectoryColumns` handle null**

Replace `apps/core/src/database/repositories/TestcasesRepository.ts:11-31` with:

```ts
/**
 * `expectedSteps`, `lastSteps` and `stepsConfig` are `Json?` columns. Prisma needs three
 * different things from us for three different intents, and conflating any two of them is
 * the bug this function exists to prevent:
 *
 *   - absent (`undefined`)  -> leave the column alone
 *   - a value               -> write it
 *   - `null`                -> clear the column, which Prisma spells `Prisma.DbNull`
 *
 * A plain `null` cast to `InputJsonValue` is rejected at runtime, which is why clearing a
 * trajectory was impossible through the API before this.
 */
export function trajectoryColumns(data: {
	expectedSteps?: unknown;
	lastSteps?: unknown;
	stepsConfig?: unknown;
	lastMismatches?: unknown;
}): {
	expectedSteps?: Prisma.InputJsonValue | typeof Prisma.DbNull;
	lastSteps?: Prisma.InputJsonValue | typeof Prisma.DbNull;
	stepsConfig?: Prisma.InputJsonValue | typeof Prisma.DbNull;
	lastMismatches?: Prisma.InputJsonValue | typeof Prisma.DbNull;
} {
	const column = (value: unknown) =>
		value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);

	return {
		...(data.expectedSteps !== undefined ? { expectedSteps: column(data.expectedSteps) } : {}),
		...(data.lastSteps !== undefined ? { lastSteps: column(data.lastSteps) } : {}),
		...(data.stepsConfig !== undefined ? { stepsConfig: column(data.stepsConfig) } : {}),
		...(data.lastMismatches !== undefined
			? { lastMismatches: column(data.lastMismatches) }
			: {}),
	};
}
```

Then add `lastMismatches` to `updateTestcase`'s destructuring (~line 139), beside the three fields already pulled out and handed to `trajectoryColumns`. Without that the run in Task 2 writes the field into a `data` object that never reaches the column.

- [ ] **Step 6: Run the repository test again**

Run: `pnpm turbo run test:run --filter=core`
Expected: PASS (4 new tests).

- [ ] **Step 7: Write the failing schema test**

Append to `apps/core/src/services/validate/types/testcase.type.test.ts`:

```ts
describe("TestcasesUpdateSchema — clearing a trajectory", () => {
	it("accepts expectedSteps: null, which means clear the trajectory", () => {
		expect(TestcasesUpdateSchema.safeParse({ expectedSteps: null }).success).toBe(true);
	});

	it("accepts stepsConfig: null", () => {
		expect(TestcasesUpdateSchema.safeParse({ stepsConfig: null }).success).toBe(true);
	});

	it("still rejects an expectedSteps whose every step is unticked", () => {
		const result = TestcasesUpdateSchema.safeParse({
			expectedSteps: [
				{ kind: "tool_call", name: "search", enabled: false },
				{ kind: "final", text: "done", enabled: false },
			],
		});
		expect(result.success).toBe(false);
	});

	it("still accepts a mixed expectedSteps", () => {
		const result = TestcasesUpdateSchema.safeParse({
			expectedSteps: [
				{ kind: "tool_call", name: "search", enabled: false },
				{ kind: "final", text: "done" },
			],
		});
		expect(result.success).toBe(true);
	});

	it("does not accept lastMismatches -- it is derived from a run, never claimed", () => {
		const result = TestcasesUpdateSchema.safeParse({
			lastMismatches: [{ index: 0, reason: "made up" }],
		});
		expect(result.success).toBe(false);
	});
});
```

- [ ] **Step 8: Run it and watch it fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL on the two `null` cases — `EnabledStepsSchema` / `StepsConfigSchema` reject `null`. The `lastMismatches` case should already pass, because the schema is `.strict()`; confirm that it does and say so in your report rather than assuming.

- [ ] **Step 9: Let the schema express "clear"**

In `apps/core/src/services/validate/types/testcase.type.ts`, change only the two fields inside `TestcasesUpdateSchema`'s `.extend({...})`:

```ts
		// `null` is how a client says "clear the trajectory": the testcase goes back to
		// being the plain text one it was before any steps were pinned. The repository
		// turns it into `Prisma.DbNull`. `undefined` still means "leave it alone".
		expectedSteps: EnabledStepsSchema.nullable().optional(),
		lastSteps: StepsSchema.optional(),
		stepsConfig: StepsConfigSchema.nullable().optional(),
```

Leave `TestcasesCreateSchema` alone: creating a testcase with an explicitly-null trajectory is just creating a text testcase, which is what omitting the field already does.

- [ ] **Step 10: Run the tests**

Run: `pnpm turbo run test:run --filter=core`
Expected: PASS.

- [ ] **Step 11: Cascade the clear in the controller**

In `apps/core/src/controllers/testcase.controller.ts`, in the update handler, before the repository call, add:

```ts
	// Clearing the trajectory clears everything that only describes a trajectory. A row
	// left holding a step config and a per-step explanation for steps that no longer
	// exist is a row nothing can interpret, so the server cascades rather than trusting
	// the client to send all three.
	if (data.expectedSteps === null) {
		data.stepsConfig = null;
		data.lastMismatches = null;
	}
```

Find the handler by searching for `TestcasesUpdateSchema` in that file. `lastMismatches` is not a field of the parsed type — the schema is `.strict()` and deliberately does not accept it — so build a derived object for the repository call rather than mutating the parsed input, and type that object to include the field. Say in your report how you shaped it.

- [ ] **Step 12: Test the cascade**

Add to the controller's existing test file (`apps/core/src/controllers/testcase.controller.test.ts`), following its harness:

```ts
	it("clearing expectedSteps also clears stepsConfig and lastMismatches", async () => {
		// A client that sends only `expectedSteps: null` must not be able to leave the row
		// holding an orphaned config or an explanation of steps that are gone.
		const { req, res } = makeReq({ body: { expectedSteps: null } });
		await TestcasesController.updateTestcase(req, res);

		expect(updateTestcaseSpy).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				expectedSteps: null,
				stepsConfig: null,
				lastMismatches: null,
			}),
		);
	});
```

Adapt the harness call to whatever `testcase.controller.test.ts` already uses — do not invent a new one.

- [ ] **Step 13: Verify and commit**

```bash
pnpm turbo run type-check --filter=core --force
pnpm turbo run test:run --filter=core
git add apps/core
git commit -m "feat(testcases): let an update clear a trajectory back to a text testcase

A Json? column is cleared with Prisma.DbNull, not null, so expectedSteps
could be written and never removed. The update schema now accepts null
for expectedSteps and stepsConfig, the repository maps it, and clearing
the trajectory cascades to everything that only describes one.

Adds the lastMismatches column in the same change: trajectoryColumns
cannot name a field Prisma's UpdateInput does not have."
```

---

### Task 2: persist the per-step verdict

**Files:**
- Modify: `apps/core/src/controllers/testcase.controller.ts` (`assertTrajectory`, and the run handler's `updateData`)
- Test: `apps/core/src/controllers/testcase.controller.test.ts`

**Interfaces:**
- Consumes: `TestCase.lastMismatches` and `trajectoryColumns`' support for it (Task 1).
- Produces: `assertTrajectory(expected, actual, stepsConfig)` returning `{ status: TestCaseStatus; thoughts: string; mismatches: StepMismatch[] }`.

`runTestcase` already computes mismatches and throws the structure away, keeping only a joined string. The web cannot mark individual steps from that string, and recomputing the comparison in the browser would put maximum bipartite matching, three argument matchers and the disabled-step rule in a second place.

- [ ] **Step 1: Write the failing test**

Add to `apps/core/src/controllers/testcase.controller.test.ts`, following its existing harness:

```ts
	it("persists the structured mismatches of a STRICT trajectory run", async () => {
		// The web marks individual steps from this. A joined string cannot say WHICH step
		// failed, which is the entire point of pinning steps one by one.
		const { req, res } = makeRunReq({
			testcase: {
				expectedSteps: [
					{ kind: "tool_call", name: "search", args: { q: "cats" } },
					{ kind: "final", text: "done" },
				],
				stepsConfig: { orderMatters: false },
				assertionType: "STRICT",
			},
			replaySteps: [
				{ kind: "tool_call", name: "search", args: { q: "dogs" } },
				{ kind: "final", text: "done" },
			],
		});

		await TestcasesController.runTestcase(req, res);

		expect(updateTestcaseSpy).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				status: TestCaseStatus.NOK,
				lastMismatches: [expect.objectContaining({ index: 0 })],
			}),
		);
	});

	it("clears lastMismatches when the verdict did not come from step comparison", async () => {
		// An AI or MANUAL verdict, or a replay that stopped, explains itself in
		// assertionThoughts. Leaving the previous run's per-step marks beside a verdict
		// that did not produce them would mark steps that were never compared.
		const { req, res } = makeRunReq({
			testcase: {
				expectedSteps: [{ kind: "tool_call", name: "search" }],
				assertionType: "MANUAL",
			},
			replaySteps: [{ kind: "tool_call", name: "search" }],
		});

		await TestcasesController.runTestcase(req, res);

		expect(updateTestcaseSpy).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ lastMismatches: null }),
		);
	});

	it("clears lastMismatches on a plain text run", async () => {
		const { req, res } = makeRunReq({
			testcase: { expectedSteps: null, assertionType: "STRICT" },
		});

		await TestcasesController.runTestcase(req, res);

		expect(updateTestcaseSpy).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ lastMismatches: null }),
		);
	});
```

The helper names above (`makeRunReq`, `updateTestcaseSpy`, `replaySteps`) are illustrative: use whatever that file already provides, and if it provides nothing close, build the smallest helper that fits its style rather than reshaping the file.

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL — `lastMismatches` is never written.

- [ ] **Step 3: Return the mismatches from `assertTrajectory`**

Replace the body of `assertTrajectory` (`apps/core/src/controllers/testcase.controller.ts:413-428`):

```ts
export function assertTrajectory(
	expected: Step[],
	actual: Step[],
	stepsConfig: StepsConfig | null,
): { status: TestCaseStatus; thoughts: string; mismatches: StepMismatch[] } {
	const mismatches = compareSteps(expected, actual, stepsConfig ?? DEFAULT_STEPS_CONFIG);

	if (mismatches.length === 0) {
		return { status: TestCaseStatus.OK, thoughts: "", mismatches };
	}

	return {
		status: TestCaseStatus.NOK,
		thoughts: mismatches.map((mismatch) => mismatch.reason).join("; "),
		mismatches,
	};
}
```

Add `StepMismatch` to the existing `@/ai/steps/compare` import in that file.

- [ ] **Step 4: Write it on the STRICT branch, clear it everywhere else**

`updateData` is built at `apps/core/src/controllers/testcase.controller.ts:246`. Add `lastMismatches` to its initial shape so every path clears it by default, then set it only where a comparison happened:

```ts
		const updateData: Record<string, unknown> = {
			lastOutput: run.answer,
			lastChainOfThoughts: run.chainOfThoughts,
			assertionThoughts: "",
			// Cleared by default and set only by the branch that actually compared steps.
			// A stale set of marks beside a verdict that no comparison produced would
			// point at steps nobody checked on this run.
			lastMismatches: null,
		};
```

Then in the STRICT trajectory branch (the `else` at line ~281 that calls `assertTrajectory`):

```ts
			} else {
				const result = assertTrajectory(
					expectedSteps,
					replay.steps,
					readStepsConfig(testcase.stepsConfig),
				);
				updateData.status = result.status;
				updateData.assertionThoughts = result.thoughts;
				updateData.lastMismatches = result.mismatches;
			}
```

Leave the `replay.stopped`, `MANUAL`, `AI` and text branches untouched — the default above already covers them.

- [ ] **Step 5: Run the tests**

Run: `pnpm turbo run test:run --filter=core`
Expected: PASS.

- [ ] **Step 6: Verify and commit**

```bash
pnpm turbo run type-check --filter=core --force
pnpm turbo run test:run --filter=core
git add apps/core/src
git commit -m "feat(testcases): persist which steps the last run matched

compareSteps already produced the per-step result and runTestcase threw
the structure away, keeping a joined string. The web cannot mark
individual steps from a sentence, and recomputing the comparison in the
browser would put the matching algorithm in a second place."
```

---

### Task 3: web types for the trajectory fields

**Files:**
- Modify: `apps/web/src/types/steps.ts`
- Modify: `apps/web/src/types/TestСase.ts` (note: the filename contains a Cyrillic С — copy it, do not retype it)
- Test: `apps/web/src/types/steps.test.ts` (create)

**Interfaces:**
- Produces: `StepMismatch` in `@/types/steps`; `TestCase.expectedSteps`, `.lastSteps`, `.stepsConfig`, `.lastMismatches`.
- Consumes: nothing.

Nothing in `apps/web` can render a trajectory today because the `TestCase` type does not declare the fields the server already sends.

- [ ] **Step 1: Mirror `StepMismatch`**

Append to `apps/web/src/types/steps.ts`:

```ts
/**
 * One expected step the last run did not match. `index` points into the testcase's
 * `expectedSteps`. Mirrors `StepMismatch` in apps/core/src/ai/steps/compare.ts -- restated
 * rather than imported, for the same reason the shapes above are.
 */
export type StepMismatch = {
	index: number;
	reason: string;
};
```

- [ ] **Step 2: Declare the fields on `TestCase`**

In `apps/web/src/types/TestСase.ts`, add to the `TestCase` interface after `assertionValue`:

```ts
	/**
	 * Present only on a trajectory testcase. `expectedSteps` is what is asserted,
	 * `lastSteps` what the last run actually did, `lastMismatches` which expected steps it
	 * failed to match. All three are `Json?` columns, so treat them as untrusted shapes:
	 * render defensively rather than assuming they parse.
	 */
	expectedSteps?: Step[];
	lastSteps?: Step[];
	stepsConfig?: StepsConfig;
	lastMismatches?: StepMismatch[];
```

and add the import at the top:

```ts
import type { Step, StepMismatch, StepsConfig } from "@/types/steps";
```

- [ ] **Step 3: Write the drift test**

Create `apps/web/src/types/steps.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { ArgsMatch, Step, StepMismatch, StepsConfig } from "./steps";

// These shapes are restated from apps/core, not imported, so nothing but a test stops
// them drifting. Each assertion is a compile-time claim wearing a runtime disguise: if a
// field is renamed or its type narrowed in core and copied here wrongly, this stops
// building.
describe("step type mirrors", () => {
	it("describes a tool call the way core does", () => {
		const step: Step = {
			kind: "tool_call",
			name: "search",
			args: { q: "cats" },
			argsMatch: "exact" satisfies ArgsMatch,
			enabled: false,
			recordedResult: "12 results",
		};
		expect(step.kind).toBe("tool_call");
	});

	it("describes a final step with no args fields", () => {
		const step: Step = { kind: "final", text: "done", enabled: true };
		expect(step.kind).toBe("final");
	});

	it("allows a tool call with neither enabled nor argsMatch, since both are optional", () => {
		const step: Step = { kind: "tool_call", name: "search" };
		expect(step.enabled).toBeUndefined();
	});

	it("describes a mismatch as an index into expectedSteps plus a reason", () => {
		const mismatch: StepMismatch = { index: 2, reason: "called with different arguments" };
		expect(mismatch.index).toBe(2);
	});

	it("describes the steps config", () => {
		const config: StepsConfig = { orderMatters: false };
		expect(config.orderMatters).toBe(false);
	});
});
```

- [ ] **Step 4: Run and verify**

Run: `pnpm turbo run test:run --filter=web`
Expected: PASS (5 new tests).
Run: `pnpm --filter web build`
Expected: clean — this is what type-checks the web app.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/types
git commit -m "feat(web): declare the trajectory fields the server already sends

The TestCase type omitted expectedSteps, lastSteps and stepsConfig, so
the fields arrived over the wire and were dropped by the type. Adds
lastMismatches alongside them and a drift test for the mirrored shapes."
```

---

### Task 4: extract a shared `StepRow`

**Files:**
- Create: `apps/web/src/components/steps/StepRow.tsx`
- Modify: `apps/web/src/components/dialogs/TestcaseStepPickerDialog.tsx:92-146`

**Interfaces:**
- Consumes: `Step`, `ArgsMatch`, `StepMismatch` from `@/types/steps` (Task 3).
- Produces: `<StepRow step index enabled onEnabledChange argsMatch onArgsMatchChange unreadableArgs outcome readOnly />`.

The picker and the new panel render the same row. Two copies drift, and this row carries the matcher semantics — the thing the whole feature asserts.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/steps/StepRow.tsx`:

```tsx
import { ChatText, Wrench } from "@phosphor-icons/react";

import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ArgsMatch, Step } from "@/types/steps";

export interface StepRowProps {
	step: Step;
	/**
	 * Recorded arguments that could not be parsed were degraded to `{}` with
	 * `argsMatch: "ignore"`. Without saying so, that renders identically to a tool
	 * genuinely called with no arguments.
	 */
	unreadableArgs?: boolean;
	/** The last run's outcome for this step. Absent means "no run to report". */
	outcome?: "matched" | "mismatched" | "not-asserted";
	/** Why it mismatched, from `StepMismatch.reason`. */
	outcomeReason?: string;
	/**
	 * This row records something that happened and cannot be edited at all — a log's
	 * recorded trace. Distinct from `disabled`, which is a live control momentarily
	 * unavailable: conflating the two makes a permanent state and a transient one
	 * indistinguishable to the reader.
	 */
	readOnly?: boolean;
	/** A write is in flight; the control is temporarily unavailable. */
	disabled?: boolean;
	onEnabledChange?: (enabled: boolean) => void;
	onArgsMatchChange?: (argsMatch: ArgsMatch) => void;
}

const OUTCOME_LABEL: Record<NonNullable<StepRowProps["outcome"]>, string> = {
	matched: "matched",
	mismatched: "did not match",
	"not-asserted": "not checked",
};

export function StepRow({
	step,
	unreadableArgs = false,
	outcome,
	outcomeReason,
	readOnly = false,
	disabled = false,
	onEnabledChange,
	onArgsMatchChange,
}: StepRowProps) {
	// `enabled` is optional and absent means enabled -- the same rule the server's
	// comparison uses. Reading it as `=== true` would render a pinned step as unticked.
	const enabled = step.enabled !== false;
	const inert = readOnly || disabled;

	return (
		<div className="flex items-start gap-3">
			<Checkbox
				className="mt-1"
				checked={enabled}
				disabled={inert}
				onCheckedChange={(checked) => onEnabledChange?.(checked === true)}
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
						{unreadableArgs && (
							<p className="mt-1 text-xs text-destructive">
								Recorded arguments could not be read -- shown as empty and
								ignored, not a genuine no-args call.
							</p>
						)}
						<Select
							value={step.argsMatch ?? "exact"}
							disabled={inert}
							onValueChange={(value) => onArgsMatchChange?.(value as ArgsMatch)}
						>
							<SelectTrigger className="mt-1 w-64">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="exact">Arguments must match exactly</SelectItem>
								<SelectItem value="subset">Only these keys must match</SelectItem>
								<SelectItem value="ignore">Ignore arguments</SelectItem>
							</SelectContent>
						</Select>
					</>
				) : (
					<div className="whitespace-pre-wrap">{step.text}</div>
				)}
				{outcome && (
					<p
						className={
							outcome === "mismatched"
								? "mt-1 text-xs text-destructive"
								: "mt-1 text-xs text-muted-foreground"
						}
					>
						{OUTCOME_LABEL[outcome]}
						{outcome === "mismatched" && outcomeReason ? `: ${outcomeReason}` : ""}
					</p>
				)}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Refactor the picker onto it**

In `apps/web/src/components/dialogs/TestcaseStepPickerDialog.tsx`, replace the whole `{steps.map(...)}` block (lines 93-146, from `<div key={...}` through its closing `</div>`) with:

```tsx
					{steps.map((step, index) => (
						<StepRow
							key={`${step.kind}-${index}`}
							step={step}
							unreadableArgs={unreadableArgsIndices?.has(index)}
							onEnabledChange={(enabled) => update(index, { enabled })}
							onArgsMatchChange={(argsMatch) => update(index, { argsMatch })}
						/>
					))}
```

Add `import { StepRow } from "@/components/steps/StepRow";` and remove the now-unused `Checkbox`, `Select*`, `Wrench` and `ChatText` imports. Leave `withDefaults`, the `enabledCount` guard, the footer and every other behaviour exactly as they are — this step changes where the row is drawn, nothing about what the dialog does.

- [ ] **Step 3: Verify the refactor changed nothing**

Run: `pnpm --filter web build`
Expected: clean.
Run: `pnpm turbo run test:run --filter=web`
Expected: PASS — `spansToSteps.test.ts` and Task 3's tests, unaffected.

Then read the rendered JSX of both versions side by side (`git diff`) and confirm in your report that the markup is identical apart from the added `outcome` block, which is not rendered when the prop is absent. There is no component test harness here, so this reading IS the verification.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "refactor(web): extract StepRow from the picker dialog

The panel added next carries the same row, and this one holds the
argument-matcher semantics the whole feature asserts. Two copies of it
would drift."
```

---

### Task 5: the trajectory hook

**Files:**
- Create: `apps/web/src/pages/prompt/playground-tabs/playground/hooks/useTestcaseTrajectory.ts`
- Create: `apps/web/src/lib/trajectoryEdits.ts`
- Test: `apps/web/src/lib/trajectoryEdits.test.ts`
- Modify: `apps/web/src/query-keys/testcases.keys.ts`

**Interfaces:**
- Consumes: `TestCase` trajectory fields (Task 3); `testcasesApi.updateTestcase`.
- Produces: `useTestcaseTrajectory({ testcaseId, testcase })` returning `{ steps, stepsConfig, mismatchByIndex, lastRunAt, hasTrajectory, saving, setStepEnabled, setStepArgsMatch, setOrderMatters, removeTrajectory, wouldEmptyTrajectory }`.

The persistence rules live here so the component stays presentational: what an edit sends, what the boundary forbids, and what removal means.

- [ ] **Step 1: Write the failing test for the pure edit helpers**

Create `apps/web/src/lib/trajectoryEdits.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { Step, StepMismatch } from "@/types/steps";
import { enabledCount, mismatchByIndex, withFinalText, withStepPatch } from "./trajectoryEdits";

const steps: Step[] = [
	{ kind: "tool_call", name: "search", args: { q: "cats" }, argsMatch: "exact" },
	{ kind: "tool_call", name: "log", enabled: false },
	{ kind: "final", text: "done" },
];

describe("withStepPatch", () => {
	it("patches one step and leaves the rest identical by reference", () => {
		const next = withStepPatch(steps, 0, { enabled: false });
		expect(next[0]).toEqual({ ...steps[0], enabled: false });
		expect(next[1]).toBe(steps[1]);
		expect(next[2]).toBe(steps[2]);
	});

	it("keeps recordedResult, which is what makes the testcase replayable later", () => {
		const recorded: Step[] = [
			{ kind: "tool_call", name: "search", recordedResult: "12 results" },
		];
		const next = withStepPatch(recorded, 0, { argsMatch: "ignore" });
		expect(next[0]).toMatchObject({ recordedResult: "12 results", argsMatch: "ignore" });
	});
});

describe("enabledCount", () => {
	it("counts a step with enabled absent as enabled", () => {
		// The server's comparison reads `enabled !== false`. Counting `=== true` here
		// would let the UI think a freshly-picked trajectory asserts nothing.
		expect(enabledCount(steps)).toBe(2);
	});

	it("is zero when every step is unticked", () => {
		expect(enabledCount(steps.map((step) => ({ ...step, enabled: false })))).toBe(0);
	});
});

describe("withFinalText", () => {
	it("rewrites the final step's text and nothing else", () => {
		const next = withFinalText(steps, "a new answer");
		expect(next[2]).toEqual({ kind: "final", text: "a new answer" });
		expect(next[0]).toBe(steps[0]);
		expect(next[1]).toBe(steps[1]);
	});

	it("keeps the final step's enabled flag, which the panel owns", () => {
		const pinned: Step[] = [{ kind: "final", text: "old", enabled: false }];
		expect(withFinalText(pinned, "new")).toEqual([
			{ kind: "final", text: "new", enabled: false },
		]);
	});

	it("returns the steps untouched when the trajectory has no final step", () => {
		// A trajectory whose last turn still asked for a tool has none. Appending one
		// would invent an assertion the author never pinned.
		const toolsOnly: Step[] = [{ kind: "tool_call", name: "search" }];
		expect(withFinalText(toolsOnly, "new")).toBe(toolsOnly);
	});
});

describe("mismatchByIndex", () => {
	it("keys reasons by the expected-step index", () => {
		const mismatches: StepMismatch[] = [{ index: 2, reason: "answer differs" }];
		expect(mismatchByIndex(mismatches).get(2)).toBe("answer differs");
	});

	it("is empty for an absent or malformed list", () => {
		expect(mismatchByIndex(undefined).size).toBe(0);
		expect(mismatchByIndex([{ index: "x" }] as unknown as StepMismatch[]).size).toBe(0);
	});
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm turbo run test:run --filter=web`
Expected: FAIL — `./trajectoryEdits` does not exist.

- [ ] **Step 3: Write the helpers**

Create `apps/web/src/lib/trajectoryEdits.ts`:

```ts
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
export function mismatchByIndex(mismatches: StepMismatch[] | undefined): Map<number, string> {
	const byIndex = new Map<number, string>();
	if (!Array.isArray(mismatches)) return byIndex;

	for (const mismatch of mismatches) {
		if (typeof mismatch?.index === "number" && typeof mismatch?.reason === "string") {
			byIndex.set(mismatch.index, mismatch.reason);
		}
	}
	return byIndex;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm turbo run test:run --filter=web`
Expected: PASS (6 new tests).

- [ ] **Step 5: Add the query key**

In `apps/web/src/query-keys/testcases.keys.ts`, beside the existing entries:

```ts
	updateTrajectory: (testcaseId: ScopeParam) => ["testcase-update-trajectory", testcaseId] as const,
```

- [ ] **Step 6: Write the hook**

Create `apps/web/src/pages/prompt/playground-tabs/playground/hooks/useTestcaseTrajectory.ts`:

```ts
import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { testcasesApi } from "@/api/testcases/testcases.api";
import { useToast } from "@/hooks/useToast";
import { enabledCount, mismatchByIndex, withStepPatch } from "@/lib/trajectoryEdits";
import { testcaseKeys } from "@/query-keys/testcases.keys";
import type { TestCase } from "@/types/TestСase";
import type { ArgsMatch, Step, StepsConfig } from "@/types/steps";

interface UseTestcaseTrajectoryParams {
	testcaseId?: string | number | null;
	testcase?: TestCase | null;
}

const NO_STEPS: Step[] = [];

export function useTestcaseTrajectory({ testcaseId, testcase }: UseTestcaseTrajectoryParams) {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	// A Json? column: a row written by hand, or before the boundary guard existed, can be
	// anything. Anything that is not an array is treated as "no trajectory" rather than
	// rendered.
	const steps = Array.isArray(testcase?.expectedSteps) ? testcase.expectedSteps : NO_STEPS;
	const hasTrajectory = steps.length > 0;

	const stepsConfig: StepsConfig = useMemo(
		() => ({ orderMatters: testcase?.stepsConfig?.orderMatters === true }),
		[testcase?.stepsConfig?.orderMatters],
	);

	const mismatches = useMemo(
		() => mismatchByIndex(testcase?.lastMismatches),
		[testcase?.lastMismatches],
	);

	const { mutateAsync, isPending } = useMutation({
		mutationKey: testcaseKeys.updateTrajectory(testcaseId ?? undefined),
		mutationFn: async (update: {
			expectedSteps?: Step[] | null;
			stepsConfig?: StepsConfig | null;
		}) => {
			if (!testcaseId) return;
			return testcasesApi.updateTestcase(testcaseId, update);
		},
		onSuccess: (data) => {
			const updated = data?.testcase;
			if (!updated || !testcaseId) return;

			queryClient.setQueryData(testcaseKeys.byId(testcaseId), { testcase: updated });
			if (testcase?.promptId) {
				queryClient.setQueryData(
					testcaseKeys.promptTestcases(testcase.promptId),
					(prev: TestCase[] | undefined) =>
						prev?.map((tc) => (tc.id === updated.id ? updated : tc)) ?? prev,
				);
			}
		},
		onError: (error: unknown) => {
			// The control re-renders from the cache, which still holds the persisted
			// value, so a rejected write leaves the checkbox showing what is actually
			// stored rather than what the author clicked.
			toast({
				title: "Could not save",
				description: error instanceof Error ? error.message : "Unknown error",
				variant: "destructive",
			});
		},
	});

	/**
	 * The boundary rejects an expectedSteps with nothing enabled -- a testcase that
	 * asserts nothing always passes. Rather than send a request we know will 400, the
	 * panel offers to remove the trajectory instead.
	 */
	const wouldEmptyTrajectory = useCallback(
		(index: number) =>
			enabledCount(withStepPatch(steps, index, { enabled: false })) === 0,
		[steps],
	);

	const setStepEnabled = useCallback(
		async (index: number, enabled: boolean) => {
			if (!enabled && wouldEmptyTrajectory(index)) return;
			await mutateAsync({ expectedSteps: withStepPatch(steps, index, { enabled }) });
		},
		[mutateAsync, steps, wouldEmptyTrajectory],
	);

	const setStepArgsMatch = useCallback(
		async (index: number, argsMatch: ArgsMatch) => {
			await mutateAsync({ expectedSteps: withStepPatch(steps, index, { argsMatch }) });
		},
		[mutateAsync, steps],
	);

	const setOrderMatters = useCallback(
		async (orderMatters: boolean) => {
			await mutateAsync({ stepsConfig: { orderMatters } });
		},
		[mutateAsync],
	);

	/**
	 * Sending `null` clears the column. The server cascades stepsConfig and
	 * lastMismatches, so the testcase is left as the plain text one underneath -- whose
	 * expectedOutput has been kept in step with the final step all along.
	 */
	const removeTrajectory = useCallback(async () => {
		await mutateAsync({ expectedSteps: null });
	}, [mutateAsync]);

	return {
		steps,
		stepsConfig,
		mismatchByIndex: mismatches,
		lastRunAt: testcase?.updatedAt,
		hasTrajectory,
		saving: isPending,
		wouldEmptyTrajectory,
		setStepEnabled,
		setStepArgsMatch,
		setOrderMatters,
		removeTrajectory,
	};
}
```

Check `testcaseKeys.byId` and `.promptTestcases` exist with those names in `apps/web/src/query-keys/testcases.keys.ts` before relying on them — `usePlaygroundTestcase.ts` uses both, so they should. If a name differs, follow the file.

- [ ] **Step 7: Verify and commit**

```bash
pnpm --filter web build
pnpm turbo run test:run --filter=web
git add apps/web/src
git commit -m "feat(web): a hook that reads and edits a testcase's trajectory

Holds the persistence rules so the panel stays presentational: an edit
never sends an all-unticked expectedSteps the boundary would reject, and
removal is expressed as the null the repository now understands."
```

---

### Task 6: the trajectory panel

**Files:**
- Create: `apps/web/src/pages/prompt/playground-tabs/components/TrajectoryPanel.tsx`
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/Playground.tsx:144-156`

**Interfaces:**
- Consumes: `StepRow` (Task 4), `useTestcaseTrajectory` (Task 5).
- Produces: `<TrajectoryPanel testcaseId testcase />`, rendered above `OutputBlock`.

- [ ] **Step 1: Create the panel**

Create `apps/web/src/pages/prompt/playground-tabs/components/TrajectoryPanel.tsx`:

```tsx
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
	const hasRun =
		Array.isArray(testcase?.lastSteps) && testcase.lastSteps.length > 0;

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
							<div key={`final-${index}`} className="flex items-start gap-3">
								<Checkbox
									className="mt-1"
									checked={step.enabled !== false}
									disabled={trajectory.saving}
									onCheckedChange={(checked) => {
										if (checked !== true && trajectory.wouldEmptyTrajectory(index)) {
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
						passes, so the trajectory has to go with it — the testcase stays, as a
						plain text one.
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
```

- [ ] **Step 2: Render it in the playground**

`apps/web/src/pages/prompt/playground-tabs/playground/Playground.tsx` already renders `TrajectorySteps` (the free-run view) above `OutputBlock` at lines 144-156. Add the panel directly above that block:

```tsx
							<TrajectoryPanel testcaseId={testcaseId} testcase={testcase.data} />
```

Import it, and check what the playground's testcase hook actually calls its loaded testcase — the file destructures a `testcase` object around line 39. Use whatever field on it holds the `TestCase`; if the shape does not match, say so in your report rather than guessing at a property name.

The two are mutually exclusive in practice — `TrajectorySteps` renders a free run in progress, `TrajectoryPanel` an open testcase's pinned steps — but neither hides the other and neither replaces `OutputBlock`. Replacing `OutputBlock` was a real defect on the previous branch: it hid the add-testcase controls permanently.

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter web build
pnpm turbo run test:run --filter=web
git add apps/web/src
git commit -m "feat(web): show and edit a testcase's pinned steps

A trajectory testcase could be created and run but never inspected: the
author could not see what it asserted, could not untick a step, and read
a failure out of a prose sentence."
```

---

### Task 7: the expected output is the final step

**Files:**
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/hooks/usePlaygroundTestcase.ts:~318-330`

**Interfaces:**
- Consumes: `withFinalText` from `@/lib/trajectoryEdits` (Task 5).
- Produces: nothing new; `handleSaveAsExpected` additionally rewrites the final step.

A trajectory testcase stores two expected answers. `runTestcase` takes the trajectory branch whenever `expectedSteps` is present and never reads `expectedOutput`, while the picker writes the log's output into both. Saving expected output today changes a field the verdict ignores.

- [ ] **Step 1: Rewrite the final step alongside**

In `usePlaygroundTestcase.ts`, the save-as-expected path builds `updateData` around line 321. Replace that block with:

```ts
			try {
				const updateData: {
					expectedOutput: string;
					expectedChainOfThoughts: string;
					expectedSteps?: Step[];
				} = {
					expectedOutput: newExpectedContent.answer,
					expectedChainOfThoughts: currentExpectedThoughts || "",
				};

				// For a trajectory testcase the final step IS the expected answer -- the
				// verdict comes from the step comparison and never reads expectedOutput.
				// Writing only the field the author can see would change nothing the test
				// checks. expectedOutput is written too, so the text testcase underneath
				// is already correct if the trajectory is later removed.
				const steps = testcase?.expectedSteps;
				if (Array.isArray(steps) && steps.length > 0) {
					const next = withFinalText(steps, newExpectedContent.answer);
					// Identity means there was no final step to rewrite: a trajectory whose
					// last turn still asked for a tool. Sending the unchanged array would
					// be a pointless write.
					if (next !== steps) {
						updateData.expectedSteps = next;
					}
				}

				await updateExpectedAsync(updateData);
			} catch (error) {
				console.error("Failed to save as expected:", error);
			}
```

Add `import { withFinalText } from "@/lib/trajectoryEdits";` and a `Step` type import. `withFinalText` (Task 5) is where the copy semantics live, tested there — every other field of every step, `recordedResult` above all, survives untouched.

Then widen `updateExpectedAsync`'s `mutationFn` parameter type (declared around line 118) to accept the optional `expectedSteps`.

- [ ] **Step 2: Check what the hook has in scope**

`testcase` may not be in scope at that point in the file under that name. Find how the hook reads the loaded testcase and use that; if it holds no testcase object at all, thread the one the caller already has rather than adding a fetch, and say in your report what you did.

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter web build
git add apps/web/src
git commit -m "fix(web): saving expected output updates the trajectory's final answer

A trajectory testcase held two expected answers and the verdict read
only the one the author could not see. The expected-output editor now
writes both, so what is shown is what is asserted."
```

---

### Task 8: the recorded trajectory in the log dialog

**Files:**
- Create: `apps/web/src/pages/prompt/playground-tabs/logs/components/LogTrajectorySection.tsx`
- Modify: `apps/web/src/pages/prompt/playground-tabs/logs/components/LogDetailsDialog.tsx:~292`

**Interfaces:**
- Consumes: `projectApi.getTraceSpans(traceId)`, `logsKeys.traceSpans(traceId)`, `spansToSteps(spans)` → `{ steps, unreadableArgsIndices }` — all shipped previously; `StepRow` (Task 4).
- Produces: `<LogTrajectorySection traceId />`.

Turning a log into a testcase is currently blind: the picker lists the steps, but the dialog it opens from never shows the chain.

- [ ] **Step 1: Create the section**

Create `apps/web/src/pages/prompt/playground-tabs/logs/components/LogTrajectorySection.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";

import { projectApi } from "@/api/project/project.api";
import { StepRow } from "@/components/steps/StepRow";
import { spansToSteps } from "@/lib/spansToSteps";
import { logsKeys } from "@/query-keys/logs.keys";

interface LogTrajectorySectionProps {
	traceId: string;
}

export function LogTrajectorySection({ traceId }: LogTrajectorySectionProps) {
	const { data, isLoading, isError } = useQuery({
		queryKey: logsKeys.traceSpans(traceId),
		queryFn: async () => {
			const response = await projectApi.getTraceSpans(traceId);
			return spansToSteps(response.spans ?? []);
		},
	});

	return (
		<div>
			<p className="mb-1 font-medium text-xs leading-none tracking-normal text-muted-foreground">
				Trajectory
			</p>
			<div className="rounded-[6px] border p-4">
				{isLoading && <p className="text-sm text-muted-foreground">Loading the trace…</p>}
				{/* An empty list and a failed read look identical if the failure is silent,
				    and they mean opposite things: "this run called no tools" versus "we
				    could not tell you what it did". */}
				{isError && (
					<p className="text-sm text-destructive">
						The recorded trace could not be loaded.
					</p>
				)}
				{data && data.steps.length === 0 && !isLoading && !isError && (
					<p className="text-sm text-muted-foreground">
						This run recorded no steps.
					</p>
				)}
				{data && data.steps.length > 0 && (
					<div className="flex flex-col gap-3">
						{data.steps.map((step, index) => (
							<StepRow
								key={`${step.kind}-${index}`}
								step={step}
								unreadableArgs={data.unreadableArgsIndices.has(index)}
								readOnly
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
```

Confirm the response field is `spans` by reading `TraceSpansResponse` in `apps/web/src/types/spans.ts` before relying on it.

- [ ] **Step 2: Render it in the dialog**

In `LogDetailsDialog.tsx`, the input/output block starts at `<div className="mt-4 flex flex-col gap-4">` (around line 292) and its first child is `{selectedLog.in && (...)}`. Insert as the first child of that block, before the input:

```tsx
							{selectedLog.trace_id && (
								<LogTrajectorySection traceId={selectedLog.trace_id} />
							)}
```

Import it. The trajectory goes above input and output because it is what produced them.

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter web build
pnpm turbo run test:run --filter=web
git add apps/web/src
git commit -m "feat(web): show a log's recorded trajectory in its detail dialog

Turning a log into a testcase was blind: the picker listed the steps but
the dialog it opens from never showed the chain."
```

---

### Task 9: mark a trajectory testcase in the list

**Files:**
- Modify: `apps/web/src/hooks/useTestcasesColumns.tsx:93-97`

**Interfaces:**
- Consumes: `TestCase.expectedSteps` (Task 3).
- Produces: nothing.

A trajectory testcase is indistinguishable from a text one in the list, so an author cannot tell which of their tests assert tool calls.

- [ ] **Step 1: Add the marker to the name cell**

Replace the `name` column's `cell` in `apps/web/src/hooks/useTestcasesColumns.tsx`:

```tsx
			cell: ({ row }) => {
				const steps = row.original.expectedSteps;
				const stepCount = Array.isArray(steps) ? steps.length : 0;

				return (
					<span className="flex items-center gap-2">
						<span className="font-medium">{row.getValue("name")}</span>
						{stepCount > 0 && (
							<span
								className="flex items-center gap-1 text-xs text-muted-foreground"
								title={`Asserts a recorded trajectory of ${stepCount} steps`}
							>
								<Wrench size={12} />
								{stepCount}
							</span>
						)}
					</span>
				);
			},
```

Add `import { Wrench } from "@phosphor-icons/react";` — matching the icon `StepRow` uses for a tool call, so the two surfaces read as the same thing.

Check that the column's row type exposes `row.original` as a `TestCase`; if the table is typed loosely, narrow it rather than casting through `any`.

- [ ] **Step 2: Verify and commit**

```bash
pnpm --filter web build
git add apps/web/src
git commit -m "feat(web): mark trajectory testcases in the list

A testcase that asserts tool calls looked exactly like one that asserts
a string."
```

---

## Self-review notes

Checked against the spec:

- Decision 1 (server computes and persists per-step pass/fail) — Task 2 writes `lastMismatches`; Task 5 reads it; Task 6 renders it.
- Decision 2 (editing does not touch the verdict) — no task writes `status` or `assertionThoughts` from an edit; Task 6 renders the last-run timestamp so the staleness is visible.
- Decision 3 (the expected-output editor is the final step) — Task 7. The final step's checkbox and outcome live in the panel (Task 6), per the spec's amended UI note.
- Decision 4 (a trajectory can be removed) — Task 1 for the boundary and the repository, Task 5 for `removeTrajectory`, Task 6 for the moment the author reaches it.
- Decision 5 (read-only trajectory in the log dialog) — Task 8, on the existing query and mapper, no new backend.
- Decision 6 (persist per action, no Save button) — Task 5's hook writes on every setter; no dirty state anywhere.
- Decision 7 (no live trajectory during a testcase run) — nothing streams; Task 6 renders from the persisted row.
- Data model — Task 2's migration, additive and nullable.
- API — Task 1 (null accepted, `lastMismatches` not writable, cascade), Task 2 (persistence).
- Web types — Task 3, including the `StepMismatch` mirror and its drift test.
- Shared `StepRow` — Task 4, consumed by Tasks 6 and 8.
- Error handling — Task 5 (toast on a rejected write, cache-backed revert; malformed `lastMismatches` degrades), Task 6 (no request that the boundary would reject), Task 8 (loading / error / empty distinguished).
- Testing — Tasks 1, 2, 3, 5 carry tests. Tasks 4, 6, 7, 8, 9 are components in a package with no component harness; each names the reading or build check that stands in, per the Global Constraints.
- Non-goals — no task re-pins a run, recomputes a verdict on edit, edits a trajectory outside the playground, or adds a step by hand.

Known soft spots, flagged for the executor rather than papered over:

- Tasks 6 and 7 both name a line range in a file they do not fully quote (`Playground.tsx`'s testcase object, `usePlaygroundTestcase`'s scope). Each says to check the real shape and report rather than guess. On the previous branch a brief named two files that did not exist; the same posture applies here.
- Task 1 Step 9 assumes the update controller has a mutable parsed `data`. If it does not, the step says to derive instead.
- Task 2's test helper names are illustrative; the file's own harness wins.
