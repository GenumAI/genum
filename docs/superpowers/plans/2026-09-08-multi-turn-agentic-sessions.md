# Multi-turn agentic sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a single-question trajectory into a multi-turn conversation that can be recorded in the playground, pinned as a testcase, replayed, and compared turn by turn.

**Architecture:** A session stays a flat `Step[]`, gaining a third kind, `user`. Turn structure is derived from it, never stored. Unticking a user reply truncates the session at the boundary, once, producing an *effective* list that replay, comparison, the step budget and the "asserts something" predicate all consume — so none of them can disagree about where the session ends.

**Tech Stack:** Node/Express/TypeScript, Prisma (PostgreSQL), ClickHouse, Vitest; React/Vite/TanStack Query/Zustand; pnpm + Turborepo; Biome.

**Spec:** [docs/superpowers/specs/2026-09-08-multi-turn-agentic-sessions-design.md](../specs/2026-09-08-multi-turn-agentic-sessions-design.md)

## Global Constraints

- **`enabled` absent means enabled.** Every predicate reads `enabled !== false`, never `=== true`. `=== true` silently drops a pinned step from an assertion and makes a failing test pass.
- **On a `user` step, `enabled === false` means "the session ends here"**, not "do not compare this". The UI must say so in words.
- **Truncation is applied once, at the boundary.** Replay, comparison, `maxStepsForRecording` and `hasEnabledStep` all consume `effectiveSteps(...)`, never the raw array.
- **`recordedResult` must survive every path** that copies or rewrites a step. Steps are copied into the testcase, never referenced, so a testcase stays replayable after ClickHouse rows age out.
- **Mismatch indices address the flat array**, not a turn-local position. `lastMismatches`, the panel's marks and every index-addressed consumer depend on this.
- **Prisma `Json?` three-state:** `undefined` leaves alone, a value writes, a JSON null must be `Prisma.DbNull`. `Prisma` is a runtime value — a file importing it via `import type` must split the import.
- **The web `TestCase` trajectory fields are `?: T | null`.** Never narrow with `!== undefined`; the server sends explicit `null`. Presence is `Array.isArray(x) && x.length > 0` — `Boolean([])` is `true`.
- **Never edit `apps/core/src/.generated/`.** Single `.env` at repo root.
- **ClickHouse is append-only** for AI run logs; transactional data goes to PostgreSQL via Prisma.
- **Adding any relation to `model User` fails `src/erasure/user-relations.test.ts`.** This plan adds no Prisma columns and no relations.
- Biome: tabs, indent width 4, line width 100, LF.
- `apps/web` is type-checked **only** by `pnpm --filter web build`; its vitest does not typecheck. `apps/web` has no component test harness and this plan does not add one.
- Run core tests through turbo: `pnpm turbo run test:run --filter=core`. Baseline at plan start: core 620 tests / 65 files, web 40 / 3.

---

## File Structure

**Server — the session model (Tasks 1-5):**
- `apps/core/src/ai/steps/types.ts` — `UserStep`, `Step` union, `Turn`.
- `apps/core/src/ai/steps/schema.ts` — `UserStepSchema`, `hasEnabledStep` on the effective list.
- `apps/core/src/ai/steps/session.ts` *(new)* — `effectiveSteps`, `turnsOf`. A leaf module with no dependency on replay or compare, because both consume it and neither may own it.
- `apps/core/src/ai/steps/replay.ts` — multi-turn loop, per-turn mock lookup, turn-aware budget and stop.
- `apps/core/src/ai/steps/compare.ts` — per-turn matching, flat indices.
- `apps/core/src/controllers/testcase.controller.ts` — effective list at the boundary, `expectedOutput` cascade, AI arm sees turns.

**Server — the wire and the record (Tasks 6-8):**
- `apps/core/src/ai/providers/index.ts` + the four provider mappers — `user` role.
- `apps/core/src/services/validate/types/prompt.type.ts` — the zod mirror.
- `apps/core/src/services/logger/spans.ts` — the `user` span type, offset over all spans.
- `apps/core/src/controllers/prompt.controller.ts` — trace on continuation, user continuation counted as a run.

**Web (Tasks 9-12):**
- `apps/web/src/types/steps.ts`, `apps/web/src/types/spans.ts` — mirrors.
- `apps/web/src/lib/spansToSteps.ts` — rebuilds user steps.
- `apps/web/src/lib/session.ts` *(new)* — the web's `effectiveSteps`/`turnsOf`, mirrored from core with a drift test.
- `apps/web/src/lib/trajectoryEdits.ts` — comparable-only counting, truncation-aware.
- `apps/web/src/components/steps/StepRow.tsx` — collapsed rows, sizes, user rows, "not reached".
- `apps/web/src/pages/prompt/playground-tabs/components/TrajectoryPanel.tsx` — grouped by turn.
- `apps/web/src/pages/prompt/playground-tabs/components/TrajectorySteps.tsx` — continue input.
- `apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/hooks/useTestcaseActions.ts` — picker on create.

---

## Task 1: The session model — `user` step, truncation, turns

**Files:**
- Modify: `apps/core/src/ai/steps/types.ts`
- Create: `apps/core/src/ai/steps/session.ts`
- Modify: `apps/core/src/ai/steps/schema.ts`
- Test: `apps/core/src/ai/steps/session.test.ts` *(new)*

**Interfaces:**
- Produces: `UserStep`; `Step = ToolCallStep | FinalStep | UserStep`; `Turn = { start: number; steps: Step[] }`; `effectiveSteps(steps: Step[]): Step[]`; `turnsOf(steps: Step[]): Turn[]`; `hasEnabledStep(steps: Step[]): boolean` (signature narrowed from `readonly { enabled?: boolean }[]`).

This task is the foundation every later one consumes. Nothing here knows about replay, comparison or HTTP.

- [ ] **Step 1: Write the failing tests**

Create `apps/core/src/ai/steps/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { effectiveSteps, turnsOf } from "./session";
import { hasEnabledStep } from "./schema";
import type { Step } from "./types";

const call = (name: string, enabled?: boolean): Step => ({
	kind: "tool_call",
	name,
	recordedResult: "{}",
	...(enabled === undefined ? {} : { enabled }),
});
const final = (text: string): Step => ({ kind: "final", text });
const user = (text: string, enabled?: boolean): Step => ({
	kind: "user",
	text,
	...(enabled === undefined ? {} : { enabled }),
});

describe("effectiveSteps", () => {
	it("returns the same array reference when nothing is truncated", () => {
		const steps = [call("a"), final("done")];
		expect(effectiveSteps(steps)).toBe(steps);
	});

	it("cuts the session at an unticked user reply, dropping it and everything after", () => {
		const steps = [call("a"), final("one"), user("again", false), call("b"), final("two")];
		expect(effectiveSteps(steps)).toEqual([call("a"), final("one")]);
	});

	it("keeps a ticked user reply and everything after it", () => {
		const steps = [call("a"), final("one"), user("again"), call("b"), final("two")];
		expect(effectiveSteps(steps)).toEqual(steps);
	});

	it("cuts at the FIRST unticked reply when several are unticked", () => {
		const steps = [
			final("one"),
			user("two", false),
			final("two"),
			user("three", false),
		];
		expect(effectiveSteps(steps)).toEqual([final("one")]);
	});

	it("ignores enabled:false on a tool call -- that means 'do not compare', not 'stop'", () => {
		const steps = [call("a", false), final("one"), user("again"), final("two")];
		expect(effectiveSteps(steps)).toEqual(steps);
	});
});

describe("turnsOf", () => {
	it("returns one turn for a single-turn session", () => {
		const steps = [call("a"), final("done")];
		expect(turnsOf(steps)).toEqual([{ start: 0, steps }]);
	});

	it("starts a new turn at each user reply and records its flat start index", () => {
		const steps = [call("a"), final("one"), user("again"), call("b"), final("two")];
		expect(turnsOf(steps)).toEqual([
			{ start: 0, steps: [call("a"), final("one")] },
			{ start: 2, steps: [user("again"), call("b"), final("two")] },
		]);
	});

	it("returns no turns for an empty list", () => {
		expect(turnsOf([])).toEqual([]);
	});
});

describe("hasEnabledStep", () => {
	it("is true for an enabled tool call", () => {
		expect(hasEnabledStep([call("a")])).toBe(true);
	});

	it("is false when every comparable step is unticked", () => {
		expect(hasEnabledStep([call("a", false), { kind: "final", text: "x", enabled: false }])).toBe(
			false,
		);
	});

	it("is false for a session of nothing but user replies", () => {
		// A reply is replayed verbatim and never compared, so it asserts nothing.
		expect(hasEnabledStep([user("one"), user("two")])).toBe(false);
	});

	it("is false when the only comparable steps are past a truncation", () => {
		// The dangerous case: the raw array looks like it asserts something, and the
		// steps that would do the asserting are dead.
		const steps = [user("stop here", false), call("a"), final("two")];
		expect(hasEnabledStep(steps)).toBe(false);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL — `Cannot find module './session'`.

- [ ] **Step 3: Add the `user` step type**

In `apps/core/src/ai/steps/types.ts`, after `FinalStep`:

```ts
/**
 * A reply the author typed after the model answered. It is an input, not an output: it
 * is replayed verbatim and never compared, which is why `enabled` means something else
 * here than on the other kinds.
 *
 * `enabled === false` ends the session at this reply. A conversation cannot have a hole
 * in the middle -- skipping a reply would replay the following turn into a context that
 * never contained this one -- so the only thing unticking can mean is "stop here".
 */
export type UserStep = {
	kind: "user";
	text: string;
	enabled?: boolean;
};

export type Step = ToolCallStep | FinalStep | UserStep;

/** A turn of the conversation. `start` is the turn's first index in the flat array. */
export type Turn = {
	start: number;
	steps: Step[];
};
```

Replace the existing `export type Step = ToolCallStep | FinalStep;` line with the union above.

- [ ] **Step 4: Create the session module**

Create `apps/core/src/ai/steps/session.ts`:

```ts
import type { Step, Turn } from "./types";

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
```

- [ ] **Step 5: Add the schema member and retarget the predicate**

In `apps/core/src/ai/steps/schema.ts`, add after `FinalStepSchema`:

```ts
export const UserStepSchema = z
	.object({
		kind: z.literal("user"),
		// A blank reply would send an empty message to the provider and compare nothing.
		text: z.string().min(1),
		enabled: z.boolean().optional(),
	})
	.strict();
```

Change the union to include it:

```ts
export const StepSchema = z.discriminatedUnion("kind", [
	ToolCallStepSchema,
	FinalStepSchema,
	UserStepSchema,
]);
```

Replace `hasEnabledStep` entirely:

```ts
/**
 * The one definition of "this trajectory asserts something", shared by the write
 * boundary (`EnabledStepsSchema`) and the read boundary (`readExpectedSteps`).
 *
 * Two rules, and both are needed. It runs on the EFFECTIVE list, because steps past a
 * truncation are dead and a session cut at turn 1 must not pass on the strength of
 * enabled steps in turn 3. It counts only comparable steps, because a user reply is
 * replayed verbatim and never compared, so a session of nothing but replies asserts
 * nothing. Either rule alone lets an always-green testcase through -- and on the read
 * side that is worse than a validation miss, because `readExpectedSteps` returning null
 * does not error, it silently reclassifies the testcase as a text one.
 */
export function hasEnabledStep(steps: Step[]): boolean {
	return effectiveSteps(steps).some((step) => step.kind !== "user" && step.enabled !== false);
}
```

Add `import { effectiveSteps } from "./session";` at the top of `schema.ts`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm turbo run test:run --filter=core`
Expected: PASS. If existing callers of `hasEnabledStep` fail to compile because they passed a looser type, widen the call site, not the function.

Run: `pnpm turbo run type-check --filter=core`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/core/src/ai/steps/types.ts apps/core/src/ai/steps/session.ts apps/core/src/ai/steps/schema.ts apps/core/src/ai/steps/session.test.ts
git commit -m "feat(steps): a session model with user replies, truncation and turns"
```

---

## Task 2: `user` role on the wire

**Files:**
- Modify: `apps/core/src/ai/providers/index.ts`
- Modify: `apps/core/src/services/validate/types/prompt.type.ts`
- Modify: `apps/core/src/ai/providers/openai/utils.ts:119`, `anthropic/utils.ts:82`, `deepseek/utils.ts:23`, `gemini/utils.ts:166` — all four mappers live in a `utils.ts`, one per provider
- Test: `apps/core/src/ai/providers/{openai,anthropic,deepseek,gemini}/utils.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `ConversationMessage` gains `{ role: "user"; content: string }`.

The spec's first draft implied this already worked. It does not: `ConversationMessage` is `assistant | tool`, mirrored `.strict()` in zod with a compile-time drift assertion.

- [ ] **Step 1: Find every mapper**

Run: `grep -rn 'role === "assistant"\|role === "tool"' apps/core/src/ai/providers/`
Expected: the four provider mappers. Read each before editing — they differ: Gemini has a comment about assistant messages with no tool calls, and Anthropic nests tool results in content blocks.

- [ ] **Step 2: Write the failing tests**

For each provider's existing test file, add one case. The OpenAI shape:

```ts
it("maps a user reply to a user message", () => {
	const result = toProviderMessages([
		{ role: "assistant", content: "one", toolCalls: [] },
		{ role: "user", content: "and in London?" },
	]);
	expect(result).toContainEqual({ role: "user", content: "and in London?" });
});
```

Use each provider's own mapper name and expected shape — read the neighbouring tests in the same file and match them. Anthropic and Gemini do not use OpenAI's shape; do not copy this assertion verbatim into them.

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL — a type error on the `user` role, or a mapper dropping the message.

- [ ] **Step 4: Widen the type**

In `apps/core/src/ai/providers/index.ts`:

```ts
export type ConversationMessage =
	| { role: "assistant"; content: string; toolCalls?: ToolCall[] }
	| { role: "tool"; toolCallId: string; name: string; content: string }
	/** A reply the human typed after the model answered -- the next turn's question. */
	| { role: "user"; content: string };
```

- [ ] **Step 5: Widen the zod mirror**

In `apps/core/src/services/validate/types/prompt.type.ts`, add a third member to the `discriminatedUnion("role", …)`:

```ts
z.object({
	role: z.literal("user"),
	content: z.string().min(1),
}).strict(),
```

The compile-time drift assertion below the union will fail until the type and the schema agree — that is the assertion doing its job, not a problem to work around.

- [ ] **Step 6: Handle the role in each mapper**

Each mapper gets a `user` case emitting that provider's user-message shape. Do not fall through to the assistant branch: a user message with an assistant role changes what the model is being asked.

- [ ] **Step 7: Run tests and type-check**

Run: `pnpm turbo run test:run --filter=core` then `pnpm turbo run type-check --filter=core`
Expected: PASS, clean.

- [ ] **Step 8: Commit**

```bash
git add apps/core/src/ai/providers apps/core/src/services/validate/types/prompt.type.ts
git commit -m "feat(providers): carry a user reply through the conversation"
```

---

## Task 3: Multi-turn replay

**Files:**
- Modify: `apps/core/src/ai/steps/replay.ts`
- Modify: `apps/core/src/controllers/testcase.controller.ts:219-235` (the call site this task's signature change breaks)
- Test: `apps/core/src/ai/steps/replay.test.ts`

**Interfaces:**
- Consumes: `effectiveSteps`, `turnsOf`, `Step`, `Turn` (Task 1); the `user` role (Task 2).
- Produces: `ReplayParams.recorded: Step[]` (was `ToolCallStep[]`); `ReplayStop.turn?: number`; `maxStepsForRecording(steps: Step[]): number` (was `(recordedToolCalls: number)`).

This task changes two signatures, so it also updates their callers — a task that breaks a signature and leaves the fix to a later task cannot honestly run the type-check its own verification step demands.

- [ ] **Step 1: Write the failing tests**

Add to `apps/core/src/ai/steps/replay.test.ts`:

```ts
it("replays a second turn by feeding the recorded user reply", async () => {
	const recorded: Step[] = [
		{ kind: "tool_call", name: "get_weather", recordedResult: '{"t":21}' },
		{ kind: "final", text: "21 in Paris" },
		{ kind: "user", text: "and in London?" },
		{ kind: "tool_call", name: "get_weather", recordedResult: '{"t":14}' },
		{ kind: "final", text: "14 in London" },
	];
	const seen: ConversationMessage[][] = [];
	const answers: ModelTurn[] = [
		{ answer: "", toolCalls: [{ id: "1", name: "get_weather", args: { city: "Paris" } }] },
		{ answer: "21 in Paris" },
		{ answer: "", toolCalls: [{ id: "2", name: "get_weather", args: { city: "London" } }] },
		{ answer: "14 in London" },
	];
	let turn = 0;
	const result = await replayTrajectory({
		callModel: async (messages) => {
			seen.push([...messages]);
			return answers[turn++];
		},
		recorded,
		maxSteps: maxStepsForRecording(recorded),
	});

	expect(result.stopped).toBeUndefined();
	expect(result.steps.filter((s) => s.kind === "final")).toHaveLength(2);
	// The reply is emitted into the result, so `lastSteps` has the same turn structure
	// as `expectedSteps` and the panel can group both.
	expect(result.steps).toContainEqual({ kind: "user", text: "and in London?" });
	// It also reached the model.
	expect(seen[2]).toContainEqual({ role: "user", content: "and in London?" });
});

it("takes the second turn's recording for the second turn's call of the same tool", async () => {
	// A global ordinal would hand turn 2 the turn-1 recording the moment turn 1 makes an
	// extra call. The lookup is per turn for the same reason the comparison is.
	const recorded: Step[] = [
		{ kind: "tool_call", name: "t", recordedResult: "first" },
		{ kind: "tool_call", name: "t", recordedResult: "second" },
		{ kind: "final", text: "one" },
		{ kind: "user", text: "again" },
		{ kind: "tool_call", name: "t", recordedResult: "third" },
		{ kind: "final", text: "two" },
	];
	const answers: ModelTurn[] = [
		{
			answer: "",
			toolCalls: [
				{ id: "1", name: "t", args: {} },
				{ id: "2", name: "t", args: {} },
			],
		},
		{ answer: "one" },
		{ answer: "", toolCalls: [{ id: "3", name: "t", args: {} }] },
		{ answer: "two" },
	];
	let i = 0;
	const result = await replayTrajectory({
		callModel: async () => answers[i++],
		recorded,
		maxSteps: maxStepsForRecording(recorded),
	});

	const results = result.steps
		.filter((s): s is ToolCallStep => s.kind === "tool_call")
		.map((s) => s.recordedResult);
	expect(results).toEqual(["first", "second", "third"]);
});

it("stops the whole session at a divergence and names the turn", async () => {
	const recorded: Step[] = [
		{ kind: "tool_call", name: "known", recordedResult: "{}" },
		{ kind: "final", text: "one" },
		{ kind: "user", text: "again" },
		{ kind: "tool_call", name: "known", recordedResult: "{}" },
		{ kind: "final", text: "two" },
	];
	const answers: ModelTurn[] = [
		{ answer: "", toolCalls: [{ id: "1", name: "known", args: {} }] },
		{ answer: "one" },
		{ answer: "", toolCalls: [{ id: "2", name: "surprise", args: {} }] },
	];
	let i = 0;
	const result = await replayTrajectory({
		callModel: async () => answers[i++],
		recorded,
		maxSteps: maxStepsForRecording(recorded),
	});

	expect(result.stopped?.reason).toBe("missing_recording");
	expect(result.stopped?.tool).toBe("surprise");
	// Turns are 1-based in the message the author reads.
	expect(result.stopped?.turn).toBe(2);
	expect(result.steps.some((s) => s.kind === "final" && s.text === "two")).toBe(false);
});

it("budgets one model call per turn, not one for the whole session", () => {
	// Five turns with eight tool calls needs 8 + 5. The old `+ 1` was the single final
	// answer; a five-turn session that gets 9 fails step_limit on every run, forever.
	const recorded: Step[] = [];
	for (let turn = 0; turn < 5; turn++) {
		if (turn > 0) recorded.push({ kind: "user", text: `q${turn}` });
		recorded.push({ kind: "tool_call", name: "t", recordedResult: "{}" });
		if (turn < 3) recorded.push({ kind: "tool_call", name: "t", recordedResult: "{}" });
		recorded.push({ kind: "final", text: `a${turn}` });
	}
	expect(recorded.filter((s) => s.kind === "tool_call")).toHaveLength(8);
	expect(maxStepsForRecording(recorded)).toBe(13);
});

it("budgets a truncated session by what it actually runs", () => {
	const recorded: Step[] = [
		{ kind: "tool_call", name: "t", recordedResult: "{}" },
		{ kind: "final", text: "one" },
		{ kind: "user", text: "dead", enabled: false },
		{ kind: "tool_call", name: "t", recordedResult: "{}" },
		{ kind: "final", text: "two" },
	];
	expect(maxStepsForRecording(recorded)).toBe(DEFAULT_MAX_STEPS);
});
```

Import `Step`, `ToolCallStep`, `ConversationMessage`, `DEFAULT_MAX_STEPS` and `maxStepsForRecording` as the file's existing imports require.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL — `maxStepsForRecording` takes a number, `ReplayStop` has no `turn`, and the loop returns at the first final.

- [ ] **Step 3: Retarget the budget**

Replace `maxStepsForRecording` in `apps/core/src/ai/steps/replay.ts`:

```ts
/**
 * The bound a replay of this recording needs. Each turn of the loop below is one model
 * call, and a session needs one call per recorded tool call plus one per turn for that
 * turn's answer. The old `+ 1` was the single final answer of a one-turn recording; a
 * five-turn session budgeted that way stops at `step_limit` and is written NOK on every
 * run, forever -- the exact failure this function exists to remove.
 *
 * Derived from the EFFECTIVE list: a truncated session is budgeted by what it runs.
 */
export function maxStepsForRecording(recorded: Step[]): number {
	const effective = effectiveSteps(recorded);
	const toolCalls = effective.filter((step) => step.kind === "tool_call").length;
	const turns = turnsOf(effective).length;
	return Math.max(DEFAULT_MAX_STEPS, toolCalls + turns);
}
```

- [ ] **Step 4: Add the turn to the stop**

```ts
export type ReplayStop = {
	reason: "missing_recording" | "step_limit";
	tool?: string;
	/** 1-based, for the author reading the message. */
	turn?: number;
	message: string;
};
```

- [ ] **Step 5: Rewrite the loop**

Replace the body of `replayTrajectory`. `recorded` becomes `Step[]`:

```ts
export type ReplayParams = {
	callModel: (messages: ConversationMessage[]) => Promise<ModelTurn>;
	/** The pinned session. Tool results are replayed from it; a tool is never executed. */
	recorded: Step[];
	maxSteps?: number;
};

export async function replayTrajectory({
	callModel,
	recorded,
	maxSteps = DEFAULT_MAX_STEPS,
}: ReplayParams): Promise<ReplayResult> {
	const turns = turnsOf(effectiveSteps(recorded));
	const messages: ConversationMessage[] = [];
	const steps: Step[] = [];
	let turnIndex = 0;
	// Per turn, not per session: a tool called in turns 1 and 3 must take turn 3's
	// recording for turn 3, the same way the comparison matches within a turn.
	let seen = new Map<string, number>();

	for (let step = 0; step < maxSteps; step++) {
		const turn = await callModel(messages);

		if (!turn.toolCalls || turn.toolCalls.length === 0) {
			steps.push({ kind: "final", text: turn.answer });

			const next = turns[turnIndex + 1];
			const reply = next?.steps[0];
			if (!next || reply?.kind !== "user") {
				return { steps };
			}

			// The reply is emitted as a step as well as fed to the model: `lastSteps` has
			// to carry the same turn structure as `expectedSteps`, or the panel can group
			// the expectation and not the actual run.
			steps.push({ kind: "user", text: reply.text });
			messages.push({ role: "user", content: reply.text });
			turnIndex += 1;
			seen = new Map();
			continue;
		}

		messages.push({ role: "assistant", content: turn.answer, toolCalls: turn.toolCalls });

		const turnRecording = turns[turnIndex]?.steps ?? [];

		for (const call of turn.toolCalls) {
			const ordinal = seen.get(call.name) ?? 0;
			seen.set(call.name, ordinal + 1);

			const match = turnRecording.filter(
				(entry): entry is ToolCallStep =>
					entry.kind === "tool_call" && entry.name === call.name,
			)[ordinal];

			if (!match || match.recordedResult === undefined) {
				return {
					steps,
					stopped: {
						reason: "missing_recording",
						tool: call.name,
						turn: turnIndex + 1,
						message: `tool "${call.name}" was called in turn ${turnIndex + 1} but the recording has no result for it`,
					},
				};
			}

			steps.push({
				kind: "tool_call",
				name: call.name,
				args: call.args,
				recordedResult: match.recordedResult,
			});
			messages.push({
				role: "tool",
				toolCallId: call.id,
				name: call.name,
				content: match.recordedResult,
			});
		}
	}

	return {
		steps,
		stopped: {
			reason: "step_limit",
			turn: turnIndex + 1,
			message: `replay stopped after ${maxSteps} steps, in turn ${turnIndex + 1}`,
		},
	};
}
```

Add `import { effectiveSteps, turnsOf } from "./session";` and keep the existing `ToolCallStep` import.

- [ ] **Step 6: Update the two callers this task breaks**

`apps/core/src/ai/steps/replay.test.ts` passes a number to `maxStepsForRecording` in five places (lines 121, 134-136, 160, 166 before your edits). Move each to the new signature: `maxStepsForRecording(nine)` rather than `maxStepsForRecording(nine.length)`, and the three standalone assertions become recordings of that many tool calls, e.g.

```ts
const callsOf = (n: number): Step[] =>
	Array.from({ length: n }, () => ({ kind: "tool_call", name: "t", recordedResult: "{}" }));

expect(maxStepsForRecording(callsOf(0))).toBe(DEFAULT_MAX_STEPS);
expect(maxStepsForRecording(callsOf(3))).toBe(DEFAULT_MAX_STEPS);
expect(maxStepsForRecording(callsOf(9))).toBe(10);
```

`callsOf(9)` is nine tool calls in one turn: 9 + 1 = 10, the same bound the old `n + 1` gave, which is what keeps these three assertions a genuine regression test of the single-turn case rather than a rewrite to match new behaviour.

In `apps/core/src/controllers/testcase.controller.ts` the recording is currently filtered down to tool calls before replay:

```ts
const recorded = expectedSteps.filter(
	(step): step is ToolCallStep => step.kind === "tool_call",
);
```

Delete the filter and pass `expectedSteps` itself — replay now derives turns from the whole session, and a list stripped of its `user` and `final` steps has exactly one turn no matter how many the author pinned. The `maxSteps` argument becomes `maxStepsForRecording(expectedSteps)`. Drop the now-unused `ToolCallStep` import if nothing else in the file uses it.

- [ ] **Step 7: Run tests and type-check to verify they pass**

Run: `pnpm turbo run test:run --filter=core` then `pnpm turbo run type-check --filter=core`
Expected: PASS, clean. The pre-existing single-turn replay tests must still pass on their behaviour — only the argument they pass has changed.

- [ ] **Step 8: Commit**

```bash
git add apps/core/src/ai/steps/replay.ts apps/core/src/ai/steps/replay.test.ts apps/core/src/controllers/testcase.controller.ts
git commit -m "feat(replay): replay a whole session, turn by turn"
```

---

## Task 4: Per-turn comparison

**Files:**
- Modify: `apps/core/src/ai/steps/compare.ts`
- Test: `apps/core/src/ai/steps/compare.test.ts`

**Interfaces:**
- Consumes: `turnsOf`, `effectiveSteps` (Task 1).
- Produces: `compareSteps(expected: Step[], actual: Step[], config: StepsConfig): StepMismatch[]` — unchanged signature, per-turn behaviour, flat indices.

- [ ] **Step 1: Write the failing test**

Add to `apps/core/src/ai/steps/compare.test.ts`:

```ts
it("does not let a call from one turn satisfy an expectation from another", () => {
	// The case the whole decision rests on. Pinned: turn 1 asks Paris, turn 2 asks
	// London. A regressed agent swaps them and answers the wrong city in both turns.
	// Flat matching over the whole session sees the same multiset and passes green.
	const expected: Step[] = [
		{ kind: "tool_call", name: "get_weather", args: { city: "Paris" } },
		{ kind: "final", text: "21 in Paris" },
		{ kind: "user", text: "and in London?" },
		{ kind: "tool_call", name: "get_weather", args: { city: "London" } },
		{ kind: "final", text: "14 in London" },
	];
	const actual: Step[] = [
		{ kind: "tool_call", name: "get_weather", args: { city: "London" } },
		{ kind: "final", text: "21 in Paris" },
		{ kind: "user", text: "and in London?" },
		{ kind: "tool_call", name: "get_weather", args: { city: "Paris" } },
		{ kind: "final", text: "14 in London" },
	];

	const mismatches = compareSteps(expected, actual, { orderMatters: false });

	expect(mismatches).toHaveLength(2);
	// Flat indices into `expected`, so the panel can point at the pinned step.
	expect(mismatches.map((m) => m.index).sort()).toEqual([0, 3]);
});

it("still ignores order inside a turn", () => {
	const expected: Step[] = [
		{ kind: "tool_call", name: "a" },
		{ kind: "tool_call", name: "b" },
		{ kind: "final", text: "done" },
	];
	const actual: Step[] = [
		{ kind: "tool_call", name: "b" },
		{ kind: "tool_call", name: "a" },
		{ kind: "final", text: "done" },
	];
	expect(compareSteps(expected, actual, { orderMatters: false })).toEqual([]);
});

it("reports a turn the run never reached as mismatched, not as passed", () => {
	const expected: Step[] = [
		{ kind: "tool_call", name: "a" },
		{ kind: "final", text: "one" },
		{ kind: "user", text: "again" },
		{ kind: "tool_call", name: "b" },
		{ kind: "final", text: "two" },
	];
	const actual: Step[] = [
		{ kind: "tool_call", name: "a" },
		{ kind: "final", text: "one" },
	];

	const mismatches = compareSteps(expected, actual, { orderMatters: false });

	expect(mismatches.map((m) => m.index).sort()).toEqual([3, 4]);
});

it("never reports a user reply as a mismatch", () => {
	// A reply is an input, replayed verbatim. There is nothing to compare.
	const expected: Step[] = [
		{ kind: "final", text: "one" },
		{ kind: "user", text: "again" },
		{ kind: "final", text: "two" },
	];
	const actual: Step[] = [
		{ kind: "final", text: "one" },
		{ kind: "user", text: "SOMETHING ELSE" },
		{ kind: "final", text: "two" },
	];
	expect(compareSteps(expected, actual, { orderMatters: false })).toEqual([]);
});

it("compares a truncated session only up to the cut", () => {
	const expected: Step[] = [
		{ kind: "final", text: "one" },
		{ kind: "user", text: "dead", enabled: false },
		{ kind: "tool_call", name: "never" },
	];
	const actual: Step[] = [{ kind: "final", text: "one" }];
	expect(compareSteps(expected, actual, { orderMatters: false })).toEqual([]);
});
```

- [ ] **Step 2: Run to verify the first test fails**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL on "does not let a call from one turn satisfy an expectation from another" — the current flat matcher returns `[]`. **If that test passes before the implementation changes, the test is wrong and pins nothing** — stop and fix the test first.

- [ ] **Step 3: Split the comparison by turn**

In `apps/core/src/ai/steps/compare.ts`, replace `compareSteps`:

```ts
/**
 * Compares a pinned session against what a run actually did, turn by turn.
 *
 * Matching is per turn because a session-wide match hides the failure this feature
 * exists to detect: with `orderMatters: false`, an agent that swaps turn 1's and turn
 * 2's tool calls presents the same multiset of calls as the recording and passes green,
 * having answered the wrong thing in both turns.
 *
 * Indices in the result address the FLAT expected array. Every consumer downstream --
 * `lastMismatches`, the panel's per-step marks -- addresses steps that way, and a
 * turn-local index would silently point at the wrong step.
 */
export function compareSteps(
	expected: Step[],
	actual: Step[],
	config: StepsConfig,
): StepMismatch[] {
	const expectedTurns = turnsOf(effectiveSteps(expected));
	const actualTurns = turnsOf(actual);
	const mismatches: StepMismatch[] = [];

	expectedTurns.forEach((turn, index) => {
		// A turn the run never reached: every comparable step in it is unmet. Reporting
		// nothing here would read as "this turn passed".
		const actualSteps = actualTurns[index]?.steps ?? [];
		const comparable = turn.steps.filter((step) => step.kind !== "user");
		const comparableActual = actualSteps.filter((step) => step.kind !== "user");

		const turnMismatches = config.orderMatters
			? compareStepsOrdered(comparable, comparableActual)
			: compareStepsUnordered(comparable, comparableActual);

		// Map each turn-local index back to its flat position. `comparable` dropped the
		// turn's leading user reply, so the offset is the turn's start plus the number of
		// user steps skipped before that index.
		const flat = turn.steps
			.map((step, position) => ({ step, position }))
			.filter((entry) => entry.step.kind !== "user")
			.map((entry) => turn.start + entry.position);

		for (const mismatch of turnMismatches) {
			mismatches.push({ ...mismatch, index: flat[mismatch.index] ?? turn.start });
		}
	});

	return mismatches;
}
```

Add `import { effectiveSteps, turnsOf } from "./session";`.

`compareStepsOrdered` and `compareStepsUnordered` keep their existing bodies — they now receive one turn's comparable steps instead of a whole session, and their maximum-matching logic is unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm turbo run test:run --filter=core`
Expected: PASS, including every pre-existing single-turn comparison test — a one-turn session is one turn, so their behaviour must be identical.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/ai/steps/compare.ts apps/core/src/ai/steps/compare.test.ts
git commit -m "feat(compare): match a session turn by turn, reporting flat indices"
```

---

## Task 5: The controller — effective list, cascade, turn-aware AI arm

**Files:**
- Modify: `apps/core/src/controllers/testcase.controller.ts`
- Test: `apps/core/src/controllers/testcase.controller.test.ts`

**Interfaces:**
- Consumes: `effectiveSteps`, `turnsOf` (Task 1); `ReplayStop.turn` (Task 3 — which also already moved this file's replay call to the new signature); `compareSteps` (Task 4).
- Produces: `expectedOutput` cascaded on every `expectedSteps` write.

- [ ] **Step 1: Write the failing tests**

Add to `apps/core/src/controllers/testcase.controller.test.ts`:

```ts
it("rewrites expectedOutput to the last enabled final when the session is truncated", async () => {
	// Truncating changes which final is last. If expectedOutput does not follow, removing
	// the trajectory later yields a text testcase asserting an answer from a turn the
	// session no longer reaches -- and the previous spec requires the text testcase
	// underneath to be correct at that moment.
	const updated = await updateTestcase(existingId, {
		expectedSteps: [
			{ kind: "final", text: "first answer" },
			{ kind: "user", text: "again", enabled: false },
			{ kind: "final", text: "second answer" },
		],
	});
	expect(updated.expectedOutput).toBe("first answer");
});

it("rewrites expectedOutput when the last final's text is edited", async () => {
	const updated = await updateTestcase(existingId, {
		expectedSteps: [
			{ kind: "final", text: "one" },
			{ kind: "user", text: "again" },
			{ kind: "final", text: "the new answer" },
		],
	});
	expect(updated.expectedOutput).toBe("the new answer");
});

it("leaves expectedOutput alone when the update carries no expectedSteps", async () => {
	const updated = await updateTestcase(existingId, { input: "changed" });
	expect(updated.expectedOutput).toBe(originalExpectedOutput);
});
```

Match the file's existing helpers for building a testcase and calling the controller — read the neighbouring tests rather than inventing `updateTestcase`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL — `expectedOutput` is untouched by a trajectory update.

- [ ] **Step 3: Cascade `expectedOutput` server-side**

In the update path, beside the existing cascade that nulls `stepsConfig` and `lastMismatches` when `expectedSteps` is cleared, add:

```ts
// The client sends only expectedSteps. The server derives expectedOutput from it, in the
// same write, so no second client writer appears -- the panel saves per action with no
// Save button, and a client-side cascade here would be a third writer of a field two
// surfaces already contend for.
if (Array.isArray(data.expectedSteps)) {
	const effective = effectiveSteps(data.expectedSteps as Step[]);
	const lastFinal = [...effective]
		.reverse()
		.find((step) => step.kind === "final" && step.enabled !== false);
	if (lastFinal?.kind === "final") {
		updateData.expectedOutput = lastFinal.text;
	}
}
```

- [ ] **Step 4: Use the effective list at the read boundary**

In `readExpectedSteps`, return the parsed steps unchanged — truncation is applied by the consumers, which all call `effectiveSteps`. Update its doc comment to say so, so the next reader does not add a second cut.

At the run site, pass the whole pinned list to `compareSteps` — it applies `effectiveSteps` itself (Task 4). The replay call beside it already passes the whole list and the whole-list budget: Task 3 changed it when it changed the signature.

- [ ] **Step 5: Report the turn on divergence**

Where `replay.stopped` becomes `assertionThoughts`, include the turn: the message built in Task 3 already names it, so pass `stopped.message` through unchanged and do not rebuild the sentence here.

- [ ] **Step 6: Give the AI arm the turn boundaries**

Where the AI assertion arm stringifies the steps, send turns rather than a flat blob:

```ts
// A judge that cannot see turn boundaries cannot catch the failure the STRICT path
// catches -- an agent that swaps two turns' tool calls looks identical when flattened.
const expectedForJudge = JSON.stringify(turnsOf(effectiveSteps(expectedSteps)));
const actualForJudge = JSON.stringify(turnsOf(replay.steps));
```

- [ ] **Step 7: Run tests and type-check**

Run: `pnpm turbo run test:run --filter=core` then `pnpm turbo run type-check --filter=core`
Expected: PASS, clean.

- [ ] **Step 8: Commit**

```bash
git add apps/core/src/controllers/testcase.controller.ts apps/core/src/controllers/testcase.controller.test.ts
git commit -m "feat(testcases): cascade expectedOutput and run a session by turns"
```

---

## Task 6: The `user` span

**Files:**
- Modify: `apps/core/src/services/logger/spans.ts` (the `SpanRow` type at `:14` and `toSpanRows` below it)
- Modify: `apps/core/src/ai/steps/turn.ts`
- Test: `apps/core/src/services/logger/spans.test.ts`, `apps/core/src/ai/steps/turn.test.ts`

**Interfaces:**
- Produces: `span_type: "llm" | "tool" | "user"`; a user span carries its text in `output`.

Without this the Logs tab cannot rebuild a multi-turn session: `spansToSteps` maps every non-tool span to a `final`, and the root `logs` row records the first question on every turn, so a later reply is durably recorded nowhere. `span_type` is `LowCardinality(String)` — no DDL is required.

- [ ] **Step 1: Write the failing tests**

```ts
it("writes a user reply as its own span, carrying the text", () => {
	const rows = toSpanRows({
		...baseBatch,
		steps: [{ kind: "user", text: "and in London?" }],
	});
	expect(rows[0].span_type).toBe("user");
	expect(rows[0].output).toBe("and in London?");
	expect(rows[0].tool_args).toBe("");
	expect(rows[0].tool_result).toBe("");
});

it("numbers spans across every kind, not only tool calls", () => {
	const rows = toSpanRows({
		...baseBatch,
		spanIndexOffset: 3,
		steps: [
			{ kind: "user", text: "again" },
			{ kind: "tool_call", name: "t", recordedResult: "{}" },
			{ kind: "final", text: "done" },
		],
	});
	expect(rows.map((r) => r.span_index)).toEqual([3, 4, 5]);
});
```

And in `apps/core/src/ai/steps/turn.test.ts`:

```ts
it("emits the reply on the request the reply itself triggered", () => {
	// Otherwise the reply is recorded nowhere: the root `logs` row holds only the
	// session's first question, and `spansToSteps` would rebuild a session that jumps
	// from one answer to the next with nothing in between.
	const { steps } = completedTurnSteps(
		[
			{ role: "assistant", content: "", toolCalls: [{ id: "1", name: "t", args: {} }] },
			{ role: "tool", toolCallId: "1", name: "t", content: "{}" },
			{ role: "assistant", content: "21 in Paris" },
			{ role: "user", content: "and in London?" },
		],
		{ answer: "", toolCalls: [{ id: "2", name: "t", args: {} }] },
	);
	// Nothing else: the previous turn's call and final already have their spans, and
	// this turn's call is not answered until the next request.
	expect(steps).toEqual([{ kind: "user", text: "and in London?" }]);
});

it("does not emit the reply again on the next request of the same turn", () => {
	// The dangerous half. One request later the same reply is still in the conversation,
	// now sitting before the last assistant message. Emitting it again writes a second
	// `user` span for one reply and shifts every later index by one.
	const { steps } = completedTurnSteps(
		[
			{ role: "assistant", content: "", toolCalls: [{ id: "1", name: "t", args: {} }] },
			{ role: "tool", toolCallId: "1", name: "t", content: "{}" },
			{ role: "assistant", content: "21 in Paris" },
			{ role: "user", content: "and in London?" },
			{ role: "assistant", content: "", toolCalls: [{ id: "2", name: "t", args: {} }] },
			{ role: "tool", toolCallId: "2", name: "t", content: "{}" },
		],
		{ answer: "14 in London" },
	);
	expect(steps.some((step) => step.kind === "user")).toBe(false);
	expect(steps).toEqual([
		{ kind: "tool_call", name: "t", args: {}, recordedResult: "{}" },
		{ kind: "final", text: "14 in London" },
	]);
});

it("counts every span an earlier turn wrote, not only its tool calls", () => {
	// The offset addresses an append-only table. A turn that answered plainly wrote an
	// `llm` span and a reply wrote a `user` span; counting only tool calls hands the next
	// turn an index two rows behind, and the trace reads back in the wrong order.
	const { spanIndexOffset } = completedTurnSteps(
		[
			// turn 1: one call, then a final -> 2 spans
			{ role: "assistant", content: "", toolCalls: [{ id: "1", name: "t", args: {} }] },
			{ role: "tool", toolCallId: "1", name: "t", content: "{}" },
			{ role: "assistant", content: "21 in Paris" },
			// the reply -> 1 span
			{ role: "user", content: "and in London?" },
			// turn 2, the last: its calls are what THIS request answered
			{ role: "assistant", content: "", toolCalls: [{ id: "2", name: "t", args: {} }] },
			{ role: "tool", toolCallId: "2", name: "t", content: "{}" },
		],
		{ answer: "14 in London" },
	);
	expect(spanIndexOffset).toBe(3);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL — a user step is written as `llm` with an empty `output`.

- [ ] **Step 3: Widen the row type**

`span_type` is declared in two places and only one of them is yours. `SpanRow` in `apps/core/src/services/logger/spans.ts:14` carries the narrow union and is what `toSpanRows` produces; `types.ts:267` types the row ClickHouse hands back and is already a plain `string`, so it needs no change, and `logger.ts:833` casts through `SpanRow["span_type"]` and follows automatically.

In `spans.ts`, change `span_type` to `"llm" | "tool" | "user"` and document it:

```ts
/**
 * `user` is a reply the human typed to continue the session; its text is in `output`.
 * Without it a multi-turn trace cannot be read back -- every non-tool span would look
 * like a model answer, and the root `logs` row records only the session's first question.
 */
span_type: "llm" | "tool" | "user";
```

- [ ] **Step 4: Map the kind**

In `toSpanRows`:

```ts
span_type: step.kind === "tool_call" ? "tool" : step.kind === "user" ? "user" : "llm",
name: step.kind === "tool_call" ? step.name : batch.model,
output: step.kind === "final" ? step.text : step.kind === "user" ? step.text : "",
```

- [ ] **Step 5: Emit the reply and fix the offset**

`completedTurnSteps` in `apps/core/src/ai/steps/turn.ts` derives everything from the conversation the client resends on every request, which is the property that lets N stateless HTTP calls build one ordered trace. Both changes below keep that property.

Emit the reply that opened this turn, before the turn's tool calls:

```ts
// The reply that opened this turn, emitted on the one request it triggered -- the request
// whose conversation ENDS with it, because nothing has answered it yet. One request later
// the same reply is still in the conversation, and any rule that finds it by scanning
// would write its span a second time.
//
// It is derived here rather than in the controller for the same reason everything else in
// this function is: the conversation is the only state, and a reply recorded anywhere else
// would not survive the next stateless request.
const lastMessage = conversation[conversation.length - 1];

const steps: Step[] = [];
if (lastMessage?.role === "user") {
	steps.push({ kind: "user", text: lastMessage.content });
}
```

Then push the existing tool-call steps into that same array -- turn the current
`const steps: Step[] = (lastTurn?.toolCalls ?? []).map(...)` into
`steps.push(...(lastTurn?.toolCalls ?? []).map(...))`, leaving the mapper body untouched.
The final-answer push at the end of the function stays where it is.

Replace the offset:

```ts
// Every span an earlier turn wrote, not only its tool calls: a turn that answered
// plainly wrote an `llm` span, and each reply wrote a `user` span. `trace_spans` is
// append-only and ordered by this index, so undercounting writes this turn's rows onto
// indices that are already taken.
const earlierTurns = assistantTurns.slice(0, -1);
const spanIndexOffset =
	earlierTurns.reduce(
		(sum, turn) => sum + (turn.toolCalls?.length ? turn.toolCalls.length : 1),
		0,
	) + conversation.filter((message) => message.role === "user").length;
```

Two things about that expression are easy to "simplify" wrongly, so both are stated here.

The `: 1` branch is not a guard against an empty array — an assistant turn either asked
for tools or gave an answer, and the one that gave an answer wrote exactly one `llm` span.
Dropping the branch undercounts every plain answer in the session.

The reply count runs over the whole conversation rather than the part before the last
assistant turn, and it deliberately includes the reply this very request is about to write.
That compensates for the last assistant turn being excluded from `earlierTurns`: on the
request a reply triggers, that excluded turn is a final whose span was already written.
Traced across a three-turn session the offsets come out 0, 0, 2, 3, 5, 6 — each equal to
the number of spans already in the table.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm turbo run test:run --filter=core`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/core/src/services/logger/spans.ts apps/core/src/services/logger/spans.test.ts apps/core/src/ai/steps/turn.ts apps/core/src/ai/steps/turn.test.ts
git commit -m "feat(spans): record a user reply so a session can be read back"
```

---

## Task 7: A trace once the session continues; a reply is a run

**Files:**
- Modify: `apps/core/src/controllers/prompt.controller.ts`
- Modify: `apps/core/src/services/validate/types/prompt.type.ts`
- Test: `apps/core/src/controllers/prompt.controller.run.test.ts`

Note the filename: merging `origin/main` brought a `prompt.controller.test.ts` of its own, and this branch's run tests moved to `prompt.controller.run.test.ts` beside it. Yours are the ones in `…run.test.ts`.

**Interfaces:**
- Consumes: the `user` role (Task 2), the `user` span (Task 6).
- Produces: a run request may carry `messages` whose last entry is a user reply; the response's `traceId` exists for any continued session.

Two changes that must land together, because both turn on telling a *user* continuation from a *tool* continuation, which the server currently cannot do — it keys only on `traceId` being present.

- [ ] **Step 1: Write the failing tests**

```ts
it("mints a trace for a session that continued without calling a tool", async () => {
	// "Turn 1 answers plainly, turn 2 asks the real question" is a normal agent session,
	// and spec 1's rule -- a trace exists only once a trajectory does -- made it
	// unrecordable. Not calling a tool is itself an answer worth pinning.
	const response = await runPrompt({ question: "hello", messages: undefined });
	expect(response.traceId).toBeUndefined();

	const continued = await runPrompt({
		question: "hello",
		messages: [
			{ role: "assistant", content: "hi" },
			{ role: "user", content: "now the real question" },
		],
	});
	expect(continued.traceId).toBeDefined();
});

it("counts a user reply as a run and a tool continuation as a turn", async () => {
	await runPrompt({ question: "q", messages: [{ role: "user", content: "again" }], traceId });
	expect(lastLoggedType).toBe(LogType.PromptRun);

	await runPrompt({
		question: "q",
		messages: [{ role: "tool", toolCallId: "1", name: "t", content: "{}" }],
		traceId,
	});
	expect(lastLoggedType).toBe(LogType.PromptRunTurn);
});
```

Read the file's existing helpers and logging spies; match them rather than inventing `runPrompt` and `lastLoggedType`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL — no trace without a tool call, and every continuation logs as `prt`.

- [ ] **Step 3: Classify the continuation**

In `apps/core/src/controllers/prompt.controller.ts`, replace the `isContinuation` / `startsTrajectory` pair:

```ts
const lastMessage = data.messages?.[data.messages.length - 1];
// A human asking the next question is a new run; the model fetching a tool result inside
// one question is not. Keyed on what the continuation carries, because `traceId` alone
// cannot tell the two apart and counting them alike makes a ten-question conversation
// one run with its success rate over a denominator of one.
const isUserContinuation = lastMessage?.role === "user";
const isToolContinuation = data.messages !== undefined && !isUserContinuation;
// A trace exists once the session continued, not once a tool was called: a session that
// answers plainly and then asks the real question is worth recording too.
const startsTrajectory = data.messages === undefined && !!run.toolCalls?.length;
```

Log type becomes `isToolContinuation ? LogType.PromptRunTurn : LogType.PromptRun`.

- [ ] **Step 4: Allow a continuation without a prior trajectory**

`PromptRunSchema`'s refine currently requires `messages` and `traceId` together. Relax it so a continuation may arrive without a `traceId` — the server mints one — while keeping the rule that a `traceId` without `messages` is rejected. Update the refine's message to say which case is being refused.

- [ ] **Step 5: Run tests and type-check**

Run: `pnpm turbo run test:run --filter=core` then `pnpm turbo run type-check --filter=core`
Expected: PASS, clean. The reply's span needs nothing here -- `completedTurnSteps` (Task 6) emits it, and this controller already calls that function. The nine `RUN_COUNT` positions in `queries.ts` are unchanged — a user reply is a `prs` row and is counted by them already.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/controllers/prompt.controller.ts apps/core/src/services/validate/types/prompt.type.ts
git commit -m "feat(runs): a trace once a session continues, and a reply counts as a run"
```

---

## Task 8: Web mirrors and the session helper

**Files:**
- Modify: `apps/web/src/types/steps.ts`, `apps/web/src/types/spans.ts`
- Create: `apps/web/src/lib/session.ts`
- Modify: `apps/web/src/lib/spansToSteps.ts`
- Test: `apps/web/src/lib/session.test.ts` *(new)*, `apps/web/src/lib/spansToSteps.test.ts`

**Interfaces:**
- Produces: web `UserStep`, `Turn`, `effectiveSteps`, `turnsOf`; `spansToSteps` emits `user` steps.

These are restated from core, not imported — `apps/web` does not depend on `apps/core`. The drift tests are compile-time claims: `apps/web`'s vitest does **not** typecheck, so only `pnpm --filter web build` enforces them. Say so in the test file's comment; do not write a comment implying the test itself would fail.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/session.test.ts` mirroring Task 1's `effectiveSteps` and `turnsOf` cases, with the web's `Step` type. Add to `spansToSteps.test.ts`:

```ts
it("rebuilds a user reply from its span", () => {
	const result = spansToSteps([
		{ ...baseSpan, span_index: 0, span_type: "tool", name: "t", tool_result: "{}" },
		{ ...baseSpan, span_index: 1, span_type: "llm", output: "one" },
		{ ...baseSpan, span_index: 2, span_type: "user", output: "and in London?" },
		{ ...baseSpan, span_index: 3, span_type: "llm", output: "two" },
	]);
	expect(result.steps[2]).toEqual({ kind: "user", text: "and in London?" });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm turbo run test:run --filter=web`
Expected: FAIL — no `session` module; every non-tool span maps to `final`.

- [ ] **Step 3: Mirror the types**

In `apps/web/src/types/steps.ts` add `UserStep` and `Turn`, widen `Step`, and extend the existing drift block with a `user` case. In `apps/web/src/types/spans.ts` widen `span_type` to `"llm" | "tool" | "user"`.

- [ ] **Step 4: Create the session helper**

Create `apps/web/src/lib/session.ts` with `effectiveSteps` and `turnsOf`, bodies identical to Task 1's, and a header comment naming `apps/core/src/ai/steps/session.ts` as the original — the same "restated, not imported" note the other mirrors carry.

- [ ] **Step 5: Map the span back**

In `spansToSteps.ts`, branch on all three types before the `final` fallback:

```ts
if (row.span_type === "user") return { kind: "user", text: row.output };
```

- [ ] **Step 6: Run tests and build**

Run: `pnpm turbo run test:run --filter=web` then `pnpm --filter web build`
Expected: PASS, clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/types apps/web/src/lib/session.ts apps/web/src/lib/session.test.ts apps/web/src/lib/spansToSteps.ts apps/web/src/lib/spansToSteps.test.ts
git commit -m "feat(web): mirror the session model and rebuild replies from spans"
```

---

## Task 9: Truncation-aware edit helpers

**Files:**
- Modify: `apps/web/src/lib/trajectoryEdits.ts`
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/hooks/useTestcaseTrajectory.ts`
- Test: `apps/web/src/lib/trajectoryEdits.test.ts`

**Interfaces:**
- Consumes: `effectiveSteps` (Task 8).
- Produces: `enabledCount` counts comparable steps in the effective list; `withFinalText` targets the **last** final.

- [ ] **Step 1: Write the failing tests**

```ts
it("counts only comparable steps, so a session of replies asserts nothing", () => {
	expect(enabledCount([{ kind: "user", text: "a" }, { kind: "user", text: "b" }])).toBe(0);
});

it("does not count steps past a truncation", () => {
	expect(
		enabledCount([
			{ kind: "user", text: "stop", enabled: false },
			{ kind: "tool_call", name: "t" },
		]),
	).toBe(0);
});

it("rewrites the LAST final, not the first", () => {
	// The separate expected-output editor shows the session's answer, which is the last
	// turn's. Targeting the first would edit a turn the author is not looking at.
	const steps: Step[] = [
		{ kind: "final", text: "one" },
		{ kind: "user", text: "again" },
		{ kind: "final", text: "two" },
	];
	expect(withFinalText(steps, "new")).toEqual([
		{ kind: "final", text: "one" },
		{ kind: "user", text: "again" },
		{ kind: "final", text: "new" },
	]);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm turbo run test:run --filter=web`
Expected: FAIL — `enabledCount` counts every kind; `withFinalText` uses `findIndex`.

- [ ] **Step 3: Update both helpers**

`enabledCount` becomes:

```ts
export function enabledCount(steps: Step[]): number {
	return effectiveSteps(steps).filter(
		(step) => step.kind !== "user" && step.enabled !== false,
	).length;
}
```

`withFinalText` targets the last final:

```ts
export function withFinalText(steps: Step[], text: string): Step[] {
	// The LAST one. The expected-output editor beside the panel shows the session's
	// answer, which is the answer to the last question asked -- targeting the first would
	// silently edit a turn the author is not looking at.
	//
	// A reverse loop rather than `findLastIndex`: apps/web targets ES2020, where that
	// method is not in the lib, and web's vitest does not typecheck -- the error would
	// surface only in `pnpm --filter web build`.
	let finalIndex = -1;
	for (let i = steps.length - 1; i >= 0; i--) {
		const step = steps[i];
		if (step.kind === "final") {
			finalIndex = i;
			break;
		}
	}
	if (finalIndex === -1) return steps;

	return steps.map((step, i) => (i === finalIndex ? { ...step, text } : step));
}
```

Both existing tests still pass unchanged: a trajectory whose last turn still asked for a tool has no final and comes back untouched, and a single unticked final is still the last one and still gets rewritten with its flag intact. The `enabled` flag is deliberately not part of the search -- the author is editing the answer they can see, and the server decides separately which final `expectedOutput` follows (Task 5, last ENABLED final), because an unticked final is excluded from the assertion and must not become the testcase's expected answer.

- [ ] **Step 4: Keep `wouldEmptyTrajectory` honest**

`useTestcaseTrajectory`'s `wouldEmptyTrajectory` must now also answer for a *user* step: unticking a reply truncates, and if the truncation leaves nothing comparable the boundary rejects it, so the panel must offer trajectory removal instead. Apply the patch, then ask `enabledCount` of the result — the existing shape already does this, and the changed `enabledCount` makes it correct for both kinds without a second code path.

- [ ] **Step 5: Run tests and build**

Run: `pnpm turbo run test:run --filter=web` then `pnpm --filter web build`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/trajectoryEdits.ts apps/web/src/lib/trajectoryEdits.test.ts apps/web/src/pages/prompt/playground-tabs/playground/hooks/useTestcaseTrajectory.ts
git commit -m "feat(web): count and edit a session, not a flat list of steps"
```

---

## Task 10: `StepRow` — collapsed, sized, and honest about the checkbox

**Files:**
- Modify: `apps/web/src/components/steps/StepRow.tsx`

**Interfaces:**
- Consumes: `Step`, `UserStep` (Task 8).
- Produces: `<StepRow step outcome outcomeReason readOnly disabled onEnabledChange onArgsMatchChange onTextChange />`, with `outcome` gaining `"not-reached"`.

There is no component harness and this task must not add one. The verification is reading the diff; say so in the report and name what was checked.

- [ ] **Step 1: Size everything**

The tool name (`font-medium`) and the final answer (`whitespace-pre-wrap`) carry no size class, so they inherit the base size while the dialog around them is `text-sm`/`text-xs` — the final answer is the largest text on screen. Add `text-sm` to both; argument JSON stays `text-xs` and gains `font-mono`.

- [ ] **Step 2: Collapse the tool call**

Render one line — the name, a middot, and the arguments as `key: value` pairs joined by commas, truncated with `truncate` — plus a disclosure control. Expanded, show the existing pretty-printed `<pre>` and, when present, `recordedResult` under a "Result" label. Collapsed is the default: at five turns the expanded form is a wall.

- [ ] **Step 3: Render a user reply**

A user row shows the reply's text and, when editable, a checkbox whose label reads **"ends the session here"** — not a bare tick. The checkbox means "do not compare" on a tool call and "stop" here, and a control carrying two meanings must say which one is in play. A comment or label that asserts what the adjacent code does not do is the defect class this branch hit three times.

- [ ] **Step 4: Make the final answer editable**

Every turn's final answer is compared, so every one is editable: the text becomes a textarea when `readOnly` is false, committing on blur, calling `onTextChange`. Remove the fixed caption "Its text is the Expected Output below" — with several finals it is false for all but one.

- [ ] **Step 5: Add the "not reached" outcome**

`outcome` gains `"not-reached"`, rendered as "not reached" in muted text. A step excluded from the assertion and a step the session never got to are different facts, and rendering the second as "not checked" would be a third way of claiming something untrue about a run.

- [ ] **Step 6: Verify and commit**

Run: `pnpm --filter web build`, `pnpm turbo run test:run --filter=web`, `pnpm exec biome check apps/web/src/components/steps/StepRow.tsx`
Expected: clean, 40+ tests still green.

```bash
git add apps/web/src/components/steps/StepRow.tsx
git commit -m "feat(web): a step row that scales to a multi-turn session"
```

---

## Task 11: `TrajectoryPanel` grouped by turn

**Files:**
- Modify: `apps/web/src/pages/prompt/playground-tabs/components/TrajectoryPanel.tsx`
- Modify: `apps/web/src/pages/prompt/playground-tabs/logs/components/LogTrajectorySection.tsx`

**Interfaces:**
- Consumes: `turnsOf`, `effectiveSteps` (Task 8); `StepRow`'s new props (Task 10). Deliberately NOT `withFinalText` — see Step 3.

- [ ] **Step 1: Group the rows**

Render `turnsOf(steps)` rather than the flat list. Each turn gets a header — "Turn N" plus its step count — and collapses whole. Rows inside a turn keep their flat index, because `mismatchByIndex` and every save call address steps that way; derive it as `turn.start + position`.

- [ ] **Step 2: Mark the dead tail**

Steps after a truncation render with `outcome="not-reached"` and their controls disabled: they are stored but dead, and a checkbox that changes nothing is worse than no checkbox.

- [ ] **Step 3: Wire the final-answer editor**

`onTextChange` on a final row patches THAT row by its flat index and sends the whole `expectedSteps`:

```ts
const next = steps.map((step, i) => (i === index ? { ...step, text } : step));
```

Not `withFinalText`: that helper searches for the last final because its caller — the separate expected-output editor — has only the text. The panel has the index of the row the author actually typed in, and searching from a row you can already name would silently edit the last turn whenever the author edited an earlier one.

The server derives `expectedOutput` from the array it receives (Task 5), so the panel sends nothing else and no second writer of that field appears.

- [ ] **Step 4: Mirror the grouping in the log dialog**

`LogTrajectorySection` renders the same grouping, `readOnly`. A recorded trace has no `enabled` and no `argsMatch`, so `readOnly` — which removes those controls from the DOM entirely — stays correct for user rows too.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter web build`, `pnpm turbo run test:run --filter=web`, `pnpm exec biome check` on both files.

```bash
git add apps/web/src/pages/prompt/playground-tabs/components/TrajectoryPanel.tsx apps/web/src/pages/prompt/playground-tabs/logs/components/LogTrajectorySection.tsx
git commit -m "feat(web): group a pinned session by turn"
```

---

## Task 12: Continue the session, and pin it from the playground

**Files:**
- Modify: `apps/web/src/pages/prompt/playground-tabs/components/TrajectorySteps.tsx`
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/hooks/usePlaygroundPromptRun.ts`
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/hooks/useTestcaseActions.ts`
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/components/outputs/Output.tsx`

**Interfaces:**
- Consumes: the `user` role (Task 2), a trace on continuation (Task 7), the picker dialog (shipped).

- [ ] **Step 1: Show a continue input after any answer**

In `TrajectorySteps`, when no tool result is pending and the last step is a final, render a textarea and a "Continue" button. Today the box simply disappears, so the author cannot tell a finished session from a broken one.

- [ ] **Step 2: Send the reply**

Add a handler beside `handleToolResult` in `usePlaygroundPromptRun` that appends `{ role: "user", content }` to `messages`, pushes a `{ kind: "user", text }` step into the trajectory, and posts the run with the same `traceId`. Reuse the generation guard the tool-result path already has — a fresh "Run" mid-flight must discard this continuation exactly the same way.

- [ ] **Step 3: Open the picker on "Add testcase"**

`useTestcaseActions.createTestcase` currently sends `input`, `expectedOutput`, `lastOutput`, `placeholders` and `files` — a run with tool calls saved this way silently becomes a text testcase. When the playground holds a trajectory, open `TestcaseStepPickerDialog` (`apps/web/src/components/dialogs/TestcaseStepPickerDialog.tsx`) with the in-memory steps and send the picked `expectedSteps` alongside the existing fields. The in-memory trajectory is used deliberately rather than a round trip through ClickHouse: it is what the author just saw.

A session with no tool calls and one turn keeps today's behaviour and shows no picker.

- [ ] **Step 4: Default the picker's user rows to ticked**

Every step starts ticked, replies included. A reply that defaults unticked would truncate every recording to its first turn the moment it is pinned.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter web build`, `pnpm turbo run test:run --filter=web`, `pnpm exec biome check` on the touched files.

```bash
git add apps/web/src/pages/prompt/playground-tabs
git commit -m "feat(web): continue a session and pin it from the playground"
```

---

## Self-review notes

**Spec coverage.** Decisions 1-3 → Tasks 1, 3, 4. Decision 4 (`input` first, placeholders) → no code: `input` is unchanged and placeholders already render into the instruction only; recorded here so a reader does not go looking for the task. Decision 5 → Task 3 (`ReplayStop.turn`) and Task 5 (message passthrough). Decision 6 → Tasks 9, 10, 11. Decision 7 → Task 5. Decision 8 → Task 7. Decision 9 → Task 7. Decision 10 → Tasks 6, 8. Decision 11 → Task 12. Decision 12 → Tasks 10, 11, 12.

**Ordering.** Task 1 must land before 3, 4, 5, 6 and 9 — all consume `effectiveSteps`. Task 2 before 3 (replay pushes a user message) and 7. Task 6 before 8 (the web mirror needs the span type) and before 7 (which writes a user span). Task 10 before 11.

**Known interface change with a blast radius.** `maxStepsForRecording` changes from `(recordedToolCalls: number)` to `(steps: Step[])`, and `ReplayParams.recorded` from `ToolCallStep[]` to `Step[]`. Both are called from `testcase.controller.ts`; Task 5 updates those call sites. A task that fails to compile because of these two is hitting the intended change, not a mistake.
