# Agentic Session Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store an agentic session as one trace per turn, grouped by a session id, so that the GenAI conventions become a field mapping and the cross-turn span numbering disappears.

**Architecture:** `trace_spans` gains `session_id` and `turn_index`; a turn's spans are written in one batch when the turn ends, numbered from zero within that turn under a freshly minted per-turn `trace_id`. `logs` is untouched — its `trace_id` column keeps addressing the whole session, which is what it has always meant. Reading a session selects across its traces and orders by `(turn_index, span_index)`.

**Tech Stack:** Node/Express/TypeScript, ClickHouse (append-only), Prisma/PostgreSQL, React/Vite, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-09-09-agentic-session-model-design.md`

## Global Constraints

- ClickHouse is append-only for AI run logs. **No row written before this change may be rewritten or mutated.** Compatibility is achieved by reading both shapes, never by backfilling.
- Never edit `apps/core/src/.generated/` — it is generated.
- Never add a relation to Prisma `model User` — it fails `src/erasure/user-relations.test.ts`.
- Single `.env` at the repo root. Never create one in a subfolder.
- `enabled` absent means enabled. Any predicate over steps reads `enabled !== false`, never `=== true`.
- Truncation lives in exactly one place: `effectiveSteps`. Never re-derive the cut.
- "The trace is the mock": a tool is never executed during replay; `recordedResult` must survive every path that copies a step.
- `apps/web` does NOT depend on `apps/core`. `apps/web/src/types/spans.ts`, `types/steps.ts`, `lib/session.ts` are hand-restated mirrors. Change a rule on one side, change it on the other.
- `apps/web` targets ES2020: no `findLast`, `findLastIndex`, `.at()`.
- `apps/web`'s vitest does NOT typecheck. `pnpm --filter web build` is the only thing that does.
- Go through turbo for core tests: `pnpm turbo run test:run --filter=core`. `pnpm --filter core test:run` fails on a never-built tree.
- Biome: tabs, indent width 4, line width 100, LF. Lint/format are already red repo-wide — judge only files you touch.
- `apps/web/src/types/TestСase.ts` contains a **Cyrillic С**. Copy the path from command output; never retype it.

## Decisions taken before the tasks

These resolve ambiguities the spec left open. They bind every task.

**The wire field stays `traceId`.** `/prompts/:id/run` accepts and returns `traceId`, and it addresses the SESSION — which is exactly what it has addressed since the day it was added. The endpoint is reachable with a project API key, so renaming the field breaks third-party callers for no behavioural gain. The client carries the same identifier it carries today.

**`logs.trace_id` keeps holding the session identifier.** Do not make it per-turn. The full cost of a trajectory is `sum(cost) WHERE log_type IN ('prs','prt') AND trace_id = ...` (`services/logger/types.ts:31`); a per-turn value there would silently reduce every trajectory's cost to one turn. Only `trace_spans.trace_id` becomes per-turn.

**Old rows keep the old vocabulary forever.** Rows written before this change carry `span_type` `llm`/`tool` and no `session_id`. They are never rewritten, so every reader must accept both vocabularies permanently. This is not a transition period.

## File Structure

**Core — storage and write path**
- `apps/core/clickhouse/migrations/20260909120000_session_and_turn.sql` (new): adds the two columns.
- `apps/core/src/services/logger/spans.ts`: `SpanRow` gains `session_id`/`turn_index`; `SpanBatch` loses `spanIndexOffset` and gains `session_id`/`turn_index`; `toSpanRows` numbers from zero and writes the conventions' operation names.
- `apps/core/src/ai/steps/turn.ts`: `completedTurnSteps` is replaced by `finishedTurnSteps`, which returns a whole turn or nothing.
- `apps/core/src/controllers/prompt.controller.ts:176-190`: writes a turn's batch only when the turn ends.
- `apps/core/src/controllers/testcase.controller.ts:464-472`: a replay writes one batch per turn.

**Core — read path**
- `apps/core/src/services/logger/queries.ts:239-251`: `GET_SPANS` becomes a session read.
- `apps/core/src/services/logger/logger.ts:804-845`: `getTraceSpans` becomes `getSessionSpans`.

**Web — mirrors**
- `apps/web/src/types/spans.ts:12`: `span_type` accepts both vocabularies.
- `apps/web/src/lib/spansToSteps.ts:32-56`: maps both vocabularies.

---

### Task 1: Storage columns and the row they produce

**Files:**
- Create: `apps/core/clickhouse/migrations/20260909120000_session_and_turn.sql`
- Modify: `apps/core/src/services/logger/spans.ts`
- Test: `apps/core/src/services/logger/spans.test.ts`

**Interfaces:**
- Produces: `SpanRow.session_id: string`, `SpanRow.turn_index: number`; `SpanBatch.session_id: string`, `SpanBatch.turn_index: number`, with `SpanBatch.spanIndexOffset` **deleted**.

This task deletes `spanIndexOffset` from the batch type, which breaks its two callers. It fixes them minimally — passing `session_id` and `turn_index: 0` — so the tree type-checks; Tasks 3 and 4 then give them their real values. A task that breaks a signature and leaves the tree red is not a task anyone can review.

- [ ] **Step 1: Write the migration**

Create `apps/core/clickhouse/migrations/20260909120000_session_and_turn.sql`:

```sql
-- Added 2026-09-09 with the session model. Before this, one trace WAS one session and
-- `span_index` ran across every turn of it; a writer therefore had to know how many spans
-- preceded it, and an append-only table cannot correct a writer that got that wrong.
--
-- A trace is now one TURN, `session_id` groups the turns of a conversation, and
-- `span_index` restarts at zero in every turn.
--
-- `String DEFAULT ''` rather than Nullable: every row written before this reads as
-- "no session", which the read path defines as a session consisting of that one trace.
-- That is not a fallback -- for those rows the trace genuinely was the whole session.
-- No mutation over history, and no backfill.
ALTER TABLE {{DB_NAME}}.trace_spans
    ADD COLUMN IF NOT EXISTS session_id String DEFAULT '',
    ADD COLUMN IF NOT EXISTS turn_index UInt16 DEFAULT 0;
```

Read `apps/core/clickhouse/migrations/README.md` first and follow whatever it says about naming and the `{{DB_NAME}}` placeholder; the existing `20260903000000_trace_spans.sql` is the reference for style.

- [ ] **Step 2: Write the failing test**

In `apps/core/src/services/logger/spans.test.ts`:

```ts
it("numbers a turn's spans from zero and stamps the session and turn on each", () => {
	// The offset is gone. Under the old model a batch had to be told how many spans
	// preceded it, and a batch that was told wrongly wrote onto indices already taken --
	// permanently, in an append-only table. A turn now owns its own numbering.
	const rows = toSpanRows({
		trace_id: "turn-trace",
		session_id: "session-1",
		turn_index: 2,
		orgId: 1,
		project_id: 2,
		prompt_id: 3,
		vendor: "openai",
		model: "gpt-4",
		steps: [
			{ kind: "tool_call", name: "weather", args: { city: "Paris" }, recordedResult: "12" },
			{ kind: "final", text: "12 in Paris" },
		],
	});

	expect(rows.map((row) => row.span_index)).toEqual([0, 1]);
	expect(rows.every((row) => row.session_id === "session-1")).toBe(true);
	expect(rows.every((row) => row.turn_index === 2)).toBe(true);
	expect(rows.every((row) => row.trace_id === "turn-trace")).toBe(true);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL — `session_id` and `turn_index` are not properties of `SpanBatch`.

- [ ] **Step 4: Widen the row and the batch**

In `apps/core/src/services/logger/spans.ts`, add to `SpanRow`, beside `trace_id`:

```ts
	/**
	 * The conversation this turn belongs to. Empty on every row written before the session
	 * model, where one trace WAS the session -- the read path treats empty as "this trace
	 * is a session by itself", which is true of those rows and of any ingested trace whose
	 * sender had no conversation id to give (the GenAI conventions forbid inventing one).
	 */
	session_id: string;
	/** The turn's ordinal in the session, 0-based. Derived by us; not a protocol field. */
	turn_index: number;
```

In `SpanBatch`, delete `spanIndexOffset` and its comment entirely, and add:

```ts
	session_id: string;
	turn_index: number;
```

In `toSpanRows`, delete the `const offset = ...` line, and change the two affected fields:

```ts
		session_id: batch.session_id,
		turn_index: batch.turn_index,
		span_index: index,
```

- [ ] **Step 5: Fix the two call sites this breaks**

Both get placeholder values here and their real ones in Tasks 3 and 4.

In `apps/core/src/controllers/prompt.controller.ts`, in the `logSpans({ ... })` call, delete the `spanIndexOffset,` line and add `session_id: traceId,` and `turn_index: 0,`.

In `apps/core/src/controllers/testcase.controller.ts`, in the `logSpans({ ... })` call at the end of `logTrajectoryRun`, add `session_id: traceId,` and `turn_index: 0,`.

`session_id: traceId` is correct in both places and stays correct: the wire's `traceId` addresses the session (see Decisions). Only `turn_index` and the per-turn `trace_id` are placeholders.

- [ ] **Step 6: Run tests and type-check**

Run: `pnpm turbo run test:run --filter=core` then `pnpm turbo run type-check --filter=core`
Expected: PASS, clean. Existing `spans.test.ts` cases that passed `spanIndexOffset` must be updated to the new field names — their assertions about what a step maps to are unchanged, only the batch they build.

- [ ] **Step 7: Commit**

```bash
git add apps/core/clickhouse/migrations/20260909120000_session_and_turn.sql apps/core/src/services/logger/spans.ts apps/core/src/services/logger/spans.test.ts apps/core/src/controllers/prompt.controller.ts apps/core/src/controllers/testcase.controller.ts
git commit -m "feat(spans): a session id and a turn ordinal, and numbering that starts at zero"
```

---

### Task 2: The conventions' vocabulary, read on both sides

**Files:**
- Modify: `apps/core/src/services/logger/spans.ts` (the `span_type` union and the two mapping expressions)
- Modify: `apps/web/src/types/spans.ts:12`
- Modify: `apps/web/src/lib/spansToSteps.ts:32-56`
- Test: `apps/core/src/services/logger/spans.test.ts`, `apps/web/src/lib/spansToSteps.test.ts`

**Interfaces:**
- Produces: `SpanRow.span_type` is `"chat" | "execute_tool" | "user" | "llm" | "tool"` on both sides — the last two are read-only legacy values that are never written again.

- [ ] **Step 1: Write the failing tests**

In `apps/core/src/services/logger/spans.test.ts`:

```ts
it("names spans the way the GenAI conventions do", () => {
	// `gen_ai.operation.name` values, and `{operation} {model|tool}` for the span name.
	// This is the cheap half of ingest compatibility: a conforming span then maps field
	// to field instead of being interpreted.
	const rows = toSpanRows({
		trace_id: "t",
		session_id: "s",
		turn_index: 0,
		orgId: 1,
		project_id: 2,
		prompt_id: 3,
		vendor: "openai",
		model: "gpt-4",
		steps: [
			{ kind: "tool_call", name: "weather", args: {}, recordedResult: "{}" },
			{ kind: "final", text: "done" },
			{ kind: "user", text: "and London?" },
		],
	});

	expect(rows[0]).toMatchObject({ span_type: "execute_tool", name: "execute_tool weather" });
	expect(rows[1]).toMatchObject({ span_type: "chat", name: "chat gpt-4" });
	// The reply is ours, not the conventions': there a human turn is an entry in
	// `gen_ai.input.messages`, not a span. Its name must still not be the model's.
	expect(rows[2]).toMatchObject({ span_type: "user", name: "user reply" });
});
```

In `apps/web/src/lib/spansToSteps.test.ts`:

```ts
it("reads both the old vocabulary and the new one", () => {
	// Rows written before the session model say `llm`/`tool` and are never rewritten --
	// ClickHouse is append-only here. Both vocabularies are permanent, not a migration.
	const { steps } = spansToSteps([
		row({ span_type: "tool", name: "weather", tool_args: "{}", tool_result: "12" }),
		row({ span_type: "llm", output: "old answer" }),
		row({ span_type: "execute_tool", name: "weather", tool_args: "{}", tool_result: "9" }),
		row({ span_type: "chat", output: "new answer" }),
	]);

	expect(steps.map((step) => step.kind)).toEqual(["tool_call", "final", "tool_call", "final"]);
});
```

`row` is the helper this file already has at the top — `function row(overrides: Partial<SpanRow>): SpanRow`, filling every field with a benign default and spreading the override. Use it; do not add a second one.

**Note on the mirror.** `apps/web/src/types/spans.ts` deliberately does NOT gain `session_id` or `turn_index`, even though core's `SpanRow` has them. The web side renders a session the server has already selected and ordered, so it reads neither column. Put that in a comment beside the web `SpanRow`, or the next reader takes the difference for an oversight in a mirror that is otherwise supposed to match field for field.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm turbo run test:run --filter=core` and `pnpm turbo run test:run --filter=web`
Expected: FAIL — core writes `tool`/`llm` and the bare name; web's mapper treats `execute_tool` as a final because it only recognises `tool`.

- [ ] **Step 3: Write the new vocabulary in core**

In `apps/core/src/services/logger/spans.ts`, change the `span_type` field of `SpanRow` to:

```ts
	/**
	 * `gen_ai.operation.name` from the GenAI conventions, so an ingested span maps field to
	 * field. `user` is ours and has no counterpart there -- a human reply is an entry in
	 * `gen_ai.input.messages` on the chat span, not a span -- but the replay engine and the
	 * comparison need the reply as an addressable step, so it stays as our normal form.
	 *
	 * `llm` and `tool` are the vocabulary rows written before the session model carry. They
	 * are never written again and never rewritten, so readers accept them permanently.
	 */
	span_type: "chat" | "execute_tool" | "user" | "llm" | "tool";
```

Replace the `span_type` mapping expression in `toSpanRows` with:

```ts
		span_type:
			step.kind === "tool_call" ? "execute_tool" : step.kind === "user" ? "user" : "chat",
```

Replace the `name` mapping expression, keeping its existing comment about not stamping the model's name on a reply:

```ts
		name:
			step.kind === "tool_call"
				? `execute_tool ${step.name}`
				: step.kind === "user"
					? "user reply"
					: `chat ${batch.model}`,
```

- [ ] **Step 4: Read both vocabularies in web**

In `apps/web/src/types/spans.ts`, change line 12 to the same union, with a one-line comment pointing at the core declaration as the original:

```ts
	/** Mirrors `SpanRow` in apps/core/src/services/logger/spans.ts. `llm`/`tool` are legacy. */
	span_type: "chat" | "execute_tool" | "user" | "llm" | "tool";
```

In `apps/web/src/lib/spansToSteps.ts`, replace the two kind tests inside the `map` callback:

```ts
		if (row.span_type === "user") {
			return { kind: "user" as const, text: row.output };
		}
		if (row.span_type !== "execute_tool" && row.span_type !== "tool") {
			return { kind: "final" as const, text: row.output };
		}
```

and strip the operation prefix from the tool name, since the step's `name` must be the tool's own name for replay to match it:

```ts
		return {
			kind: "tool_call" as const,
			name: row.name.startsWith("execute_tool ")
				? row.name.slice("execute_tool ".length)
				: row.name,
			...args,
			recordedResult: row.tool_result,
		};
```

The prefix strip is not cosmetic: `replayTrajectory` matches a recorded call by `name`, so a step named `execute_tool weather` would never match a model calling `weather`, and every pinned testcase would stop at `missing_recording`.

- [ ] **Step 5: Add the test that pins the prefix strip**

In `apps/web/src/lib/spansToSteps.test.ts`:

```ts
it("gives a tool step the tool's own name, not the span's operation-prefixed one", () => {
	// `replayTrajectory` matches a recorded call by name. A step called
	// "execute_tool weather" matches nothing the model ever calls, so every testcase
	// pinned from a new-vocabulary trace would stop at `missing_recording`.
	const { steps } = spansToSteps([
		row({ span_type: "execute_tool", name: "execute_tool weather", tool_args: "{}" }),
	]);

	expect(steps[0]).toMatchObject({ kind: "tool_call", name: "weather" });
});
```

- [ ] **Step 6: Run tests, type-check and build**

Run: `pnpm turbo run test:run --filter=core`, `pnpm turbo run type-check --filter=core`, `pnpm turbo run test:run --filter=web`, `pnpm --filter web build`
Expected: all PASS and clean.

- [ ] **Step 7: Commit**

```bash
git add apps/core/src/services/logger/spans.ts apps/core/src/services/logger/spans.test.ts apps/web/src/types/spans.ts apps/web/src/lib/spansToSteps.ts apps/web/src/lib/spansToSteps.test.ts
git commit -m "feat(spans): carry the GenAI operation names, and read the old vocabulary forever"
```

---

### Task 3: A turn is written once, when it ends

**Files:**
- Modify: `apps/core/src/ai/steps/turn.ts`
- Modify: `apps/core/src/controllers/prompt.controller.ts:176-190`
- Test: `apps/core/src/ai/steps/turn.test.ts`, `apps/core/src/controllers/prompt.controller.run.test.ts`

**Interfaces:**
- Consumes: `SpanBatch.session_id`, `SpanBatch.turn_index` (Task 1).
- Produces: `finishedTurnSteps(messages: ConversationMessage[] | undefined, response: { answer: string; toolCalls?: ToolCall[] }): { steps: Step[]; turnIndex: number } | null` — replacing `completedTurnSteps`. `null` means the turn has not ended and nothing is written.
- `conversationNumberingProblem` keeps its current signature and behaviour: the rule that every reply follows an assistant answer is what makes the turn boundary findable, and it is still checked before anything is written.

Note the test filename: `prompt.controller.run.test.ts`. A `prompt.controller.test.ts` from `origin/main` sits beside it; this branch's run tests are in the `…run.test.ts` one.

- [ ] **Step 1: Write the failing tests**

In `apps/core/src/ai/steps/turn.test.ts`:

```ts
it("writes nothing while the turn is still asking for tools", () => {
	// The whole point of the change: a turn is written once, whole. Mid-turn requests
	// wrote spans before, which is why a writer needed to know how many spans preceded it.
	const result = finishedTurnSteps(undefined, {
		answer: "",
		toolCalls: [{ id: "1", name: "weather", args: { city: "Paris" } }],
	});

	expect(result).toBeNull();
});

it("emits the whole turn when the model answers, in order", () => {
	// The turn's tool calls came in over several requests; the conversation carries them
	// all, and the answer arrives in `response`. All of it is one batch.
	const result = finishedTurnSteps(
		[
			{ role: "assistant", content: "", toolCalls: [{ id: "1", name: "weather", args: { city: "Paris" } }] },
			{ role: "tool", toolCallId: "1", name: "weather", content: "12" },
		],
		{ answer: "12 in Paris" },
	);

	expect(result).toEqual({
		turnIndex: 0,
		steps: [
			{ kind: "tool_call", name: "weather", args: { city: "Paris" }, recordedResult: "12" },
			{ kind: "final", text: "12 in Paris" },
		],
	});
});

it("starts a later turn at the reply that opened it, and numbers the turn", () => {
	// Turn 2. Turn 1's spans are already written under their own trace, so they must not
	// appear again -- the batch starts after the reply that opened this turn.
	const result = finishedTurnSteps(
		[
			{ role: "assistant", content: "", toolCalls: [{ id: "1", name: "weather", args: { city: "Paris" } }] },
			{ role: "tool", toolCallId: "1", name: "weather", content: "12" },
			{ role: "assistant", content: "12 in Paris" },
			{ role: "user", content: "and London?" },
			{ role: "assistant", content: "", toolCalls: [{ id: "2", name: "weather", args: { city: "London" } }] },
			{ role: "tool", toolCallId: "2", name: "weather", content: "9" },
		],
		{ answer: "9 in London" },
	);

	expect(result).toEqual({
		turnIndex: 1,
		steps: [
			{ kind: "user", text: "and London?" },
			{ kind: "tool_call", name: "weather", args: { city: "London" }, recordedResult: "9" },
			{ kind: "final", text: "9 in London" },
		],
	});
});

it("emits a turn that answered without calling a tool", () => {
	const result = finishedTurnSteps(
		[
			{ role: "assistant", content: "hello" },
			{ role: "user", content: "what is the weather?" },
		],
		{ answer: "I need a tool for that" },
	);

	expect(result).toEqual({
		turnIndex: 1,
		steps: [
			{ kind: "user", text: "what is the weather?" },
			{ kind: "final", text: "I need a tool for that" },
		],
	});
});
```

In `apps/core/src/controllers/prompt.controller.run.test.ts`, add a test asserting that a mid-turn request writes no spans and a turn-ending request writes exactly one batch carrying `session_id` and the turn's own fresh `trace_id`. Follow whatever mocking that file already uses for `logSpans`; assert on the call, not on rows.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL — `finishedTurnSteps` does not exist.

- [ ] **Step 3: Replace `completedTurnSteps`**

In `apps/core/src/ai/steps/turn.ts`, delete `completedTurnSteps` entirely — including the `spanIndexOffset` computation and the doc comment above it that explains the offset — and put this in its place. Keep `conversationNumberingProblem` and its comment exactly as they are.

```ts
/**
 * The steps of one playground turn, or `null` while the turn is still running.
 *
 * The playground's agentic loop runs in the BROWSER: the model asks for a tool, the author
 * types its result in, and the whole conversation comes back on the next request. A turn
 * therefore spans several requests, and only the request the model answers on knows the
 * whole turn.
 *
 * That is why the turn is written here, once, at its end. Writing each request's fragment
 * as it arrived is what forced a writer to know how many spans preceded it -- and
 * `trace_spans` is append-only, so a writer that got that number wrong could never be
 * corrected. A turn that owns its own numbering cannot get it wrong.
 *
 * The price is that an abandoned turn records no steps. Its `logs` rows are written per
 * request regardless, so no usage and no cost is lost -- only the step detail of a turn
 * nobody finished, which was never pinnable as an expectation anyway.
 */
export function finishedTurnSteps(
	messages: ConversationMessage[] | undefined,
	response: { answer: string; toolCalls?: ToolCall[] },
): { steps: Step[]; turnIndex: number } | null {
	// The model asked for more tools: the turn continues, and its steps are not all known.
	if (response.toolCalls && response.toolCalls.length > 0) {
		return null;
	}

	const conversation = messages ?? [];

	// Each reply opens a turn, and the opening question travels in `question` rather than
	// in `messages`, so the number of replies IS this turn's ordinal.
	const replyIndices = conversation
		.map((message, index) => (message.role === "user" ? index : -1))
		.filter((index) => index !== -1);
	const turnIndex = replyIndices.length;

	// This turn starts at the reply that opened it. Everything before belongs to turns
	// whose spans are already written, under their own traces.
	const start = replyIndices.length > 0 ? replyIndices[replyIndices.length - 1] : 0;
	const turnMessages = conversation.slice(start);

	const recordedResults = new Map<string, string>();
	for (const message of turnMessages) {
		if (message.role === "tool") {
			recordedResults.set(message.toolCallId, message.content);
		}
	}

	const steps: Step[] = [];
	const opening = turnMessages[0];
	if (opening?.role === "user") {
		steps.push({ kind: "user", text: opening.content });
	}

	for (const message of turnMessages) {
		if (message.role !== "assistant") {
			continue;
		}
		for (const call of message.toolCalls ?? []) {
			steps.push({
				kind: "tool_call",
				name: call.name,
				args: call.args,
				recordedResult: recordedResults.get(call.id),
			});
		}
	}

	steps.push({ kind: "final", text: response.answer });

	return { steps, turnIndex };
}
```

- [ ] **Step 4: Write the turn's batch in the controller**

In `apps/core/src/controllers/prompt.controller.ts`, replace the `completedTurnSteps` block and the `logSpans` call that follows it with:

```ts
		// One batch per turn, written on the request the turn ends on. `traceId` addresses
		// the SESSION -- it always has -- and the turn gets its own trace id here, so that
		// a trace is one turn, the way the GenAI conventions have it.
		const turn = traceId ? finishedTurnSteps(messages, run) : null;
		if (traceId && turnUsage && turn && turn.steps.length > 0) {
			await logSpans({
				trace_id: randomUUID(),
				session_id: traceId,
				turn_index: turn.turnIndex,
				orgId: turnUsage.orgId,
				project_id: turnUsage.project_id,
				prompt_id: turnUsage.prompt_id,
				vendor: turnUsage.vendor,
				model: turnUsage.model,
				steps: turn.steps,
			});
		}
```

Update the import on the file's `@/ai/steps/turn` line from `completedTurnSteps` to `finishedTurnSteps`. `randomUUID` is already imported in this file.

- [ ] **Step 5: Run tests and type-check**

Run: `pnpm turbo run test:run --filter=core` then `pnpm turbo run type-check --filter=core`
Expected: PASS, clean. Existing `turn.test.ts` cases written against `completedTurnSteps` are replaced by the ones in Step 1 — they asserted an offset that no longer exists, so they are not adapted, they are deleted with the function.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/ai/steps/turn.ts apps/core/src/ai/steps/turn.test.ts apps/core/src/controllers/prompt.controller.ts apps/core/src/controllers/prompt.controller.run.test.ts
git commit -m "feat(trace): write a turn's spans once, when the turn ends"
```

---

### Task 4: A replay writes one trace per turn

**Files:**
- Modify: `apps/core/src/controllers/testcase.controller.ts:417-473` (`logTrajectoryRun`)
- Test: `apps/core/src/controllers/testcase.controller.test.ts`

**Interfaces:**
- Consumes: `SpanBatch.session_id`, `SpanBatch.turn_index` (Task 1); `turnsOf`, `effectiveSteps` from `@/ai/steps/session` (already exist).

A replay has the easier job of the two writers: it ends knowing every turn it produced, so it writes one batch per turn in a single pass and never needs an offset either.

- [ ] **Step 1: Write the failing test**

In `apps/core/src/controllers/testcase.controller.test.ts`:

```ts
it("writes one trace per replayed turn, sharing one session", async () => {
	// A replay knows all its turns at once. Writing them as one trace would rebuild the
	// session-wide numbering this whole change removes, and would say -- in an append-only
	// table -- that a three-turn conversation was one request.
	// ...arrange a two-turn replay through whatever harness this file already uses...

	const batches = logSpansMock.mock.calls.map(([batch]) => batch);

	expect(batches).toHaveLength(2);
	expect(new Set(batches.map((batch) => batch.session_id)).size).toBe(1);
	expect(batches.map((batch) => batch.turn_index)).toEqual([0, 1]);
	expect(new Set(batches.map((batch) => batch.trace_id)).size).toBe(2);
	expect(batches.every((batch) => batch.steps.length > 0)).toBe(true);
});
```

Build the arrangement with the mocks and helpers this file already has — do not invent a new harness. If `logSpans` is not currently mocked here, mock it the way the file mocks `logUsage`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL — one call, with `turn_index: 0` and a single trace.

- [ ] **Step 3: Split the write by turn**

In `apps/core/src/controllers/testcase.controller.ts`, replace the single `logSpans({ ... })` call at the end of `logTrajectoryRun` with:

```ts
	// One trace per turn, all under the session the run was logged against. `turnsOf`
	// derives the turns from the steps themselves -- the same rule the panel and the
	// comparison use -- so this cannot disagree with how the session is read back.
	const spanTurns = turnsOf(steps);
	for (let turnIndex = 0; turnIndex < spanTurns.length; turnIndex++) {
		await logSpans({
			trace_id: randomUUID(),
			session_id: traceId,
			turn_index: turnIndex,
			orgId: base.orgId,
			project_id: base.project_id,
			prompt_id: base.prompt_id,
			vendor: base.vendor,
			model: base.model,
			steps: spanTurns[turnIndex].steps,
		});
	}
```

The local is called `spanTurns` because `logTrajectoryRun` already has a parameter named `turns` — the `LogDocument[]` of billed provider calls, which is a different thing from a conversation's turns and is used a few lines above to build the root row. Shadowing it would be a genuine trap here.

No new imports: `randomUUID` (line 1), `turnsOf` and `effectiveSteps` (line 18) are already imported in this file. `steps` is the function's own third parameter, `base` is `turns[turns.length - 1]`, and `traceId` is its first parameter — all already in scope.

Do **not** apply `effectiveSteps` here. These are the steps the replay actually produced, not an expectation being truncated; every one of them happened and every one is recorded.

- [ ] **Step 3a: Update the failed-run assertion**

`apps/core/src/controllers/testcase.controller.test.ts:714` asserts
`expect(logSpans).toHaveBeenCalledWith(expect.objectContaining({ steps: [] }))`. That
passes today because a failed run calls `logTrajectoryRun(traceId, turns, [], { failed: true })`
(line 266) and the old code called `logSpans` unconditionally, leaving `logSpans` itself to
return early on an empty batch.

Under the loop there are zero turns, so `logSpans` is not called at all. Change that
assertion to `expect(logSpans).not.toHaveBeenCalled()`.

This is a strict improvement and must not be "fixed" the other way: the test's intent is
that a failed run records no steps, and not calling the writer states that more directly
than calling it with nothing. Do not add an empty-batch call back to preserve the old
assertion.

Check the neighbouring `toHaveBeenCalledTimes(1)` assertions (lines 672 and 744) while you
are there: they stay correct for a single-turn trajectory, which is what those cases build,
but if either arranges more than one turn it now expects one call per turn.

- [ ] **Step 4: Run tests and type-check**

Run: `pnpm turbo run test:run --filter=core` then `pnpm turbo run type-check --filter=core`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/controllers/testcase.controller.ts apps/core/src/controllers/testcase.controller.test.ts
git commit -m "feat(testcases): a replayed session is written one trace per turn"
```

---

### Task 5: Reading a session across its traces

**Files:**
- Modify: `apps/core/src/services/logger/queries.ts:239-251`
- Modify: `apps/core/src/services/logger/logger.ts:804-845`
- Modify: `apps/core/src/services/logger/where.builder.ts` (a `sessionId` condition)
- Test: `apps/core/src/services/logger/queries.test.ts`

**Interfaces:**
- Produces: `getSessionSpans(sessionId: string, orgId: number, projectId: number): Promise<SpanRow[]>`, replacing `getTraceSpans` with the same argument order and return type.

- [ ] **Step 1: Write the failing test**

In `apps/core/src/services/logger/queries.test.ts`:

```ts
it("reads a session across its turns, and a pre-change trace as a session of one", () => {
	const sql = QUERIES.GET_SPANS(CLICKHOUSE_TABLES.TRACE_SPANS, "orgId = 1");

	// Both shapes, in one query. Rows written before the session model carry no
	// `session_id` and ARE their session; they are never rewritten, so this disjunction is
	// permanent rather than a migration window.
	expect(sql).toContain("session_id = {session: String}");
	expect(sql).toContain("session_id = '' AND trace_id = {session: String}");
	// Turn order first, then step order within the turn. Ordering by `span_index` alone
	// would interleave the turns, since each one now numbers from zero.
	expect(sql).toContain("ORDER BY turn_index ASC, span_index ASC");
});
```

Match the assertions to how `queries.test.ts` already tests query strings; if it asserts on normalised whitespace, follow that.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm turbo run test:run --filter=core`
Expected: FAIL — the query orders by `span_index` only and knows nothing of `session_id`.

- [ ] **Step 3: Make it a session read**

In `apps/core/src/services/logger/queries.ts`, replace `GET_SPANS` and its comment with:

```ts
	/**
	 * Get the spans of one SESSION, in turn order and then step order. A session is one or
	 * more traces -- one per turn -- grouped by `session_id`.
	 *
	 * The disjunction is what makes a row written before the session model readable: those
	 * rows have no `session_id` and their `trace_id` IS the session, which was true of them
	 * when they were written. ClickHouse is append-only here, so they are never rewritten
	 * and this branch is permanent.
	 *
	 * Bounded like GET_LOGS: a session's span count is unbounded across turns -- each
	 * request caps its own steps, the session does not -- so an unlimited SELECT returns a
	 * whole conversation's rows in one response.
	 */
	GET_SPANS: (table: string, where: string) => `
		SELECT *
		FROM ${table}
		WHERE ${where}
		  AND (session_id = {session: String}
		       OR (session_id = '' AND trace_id = {session: String}))
		ORDER BY turn_index ASC, span_index ASC
		LIMIT {limit: UInt64}
	`,
```

The session condition is inline rather than built by `WhereBuilder` because it is a disjunction over two columns; the builder's `addCondition` produces conjoined equalities and cannot express it. Leave `WhereBuilder` alone — do not add a `sessionId` method that would have to be used with the disjunction anyway.

- [ ] **Step 4: Rename and rewire the reader**

In `apps/core/src/services/logger/logger.ts`, rename `getTraceSpans` to `getSessionSpans`, rename its first parameter to `sessionId`, drop the `.traceId(traceId)` call from the `WhereBuilder` chain, and pass the identifier as a query parameter instead:

```ts
		const { where, params } = WhereBuilder.forOrg(orgId).projectId(projectId).build();

		const result = await clickhouseClient.query({
			query: QUERIES.GET_SPANS(CLICKHOUSE_TABLES.TRACE_SPANS, where),
			query_params: { ...params, session: sessionId, limit: MAX_TRACE_SPANS },
			format: "JSONEachRow",
		});
```

Add the two new columns to the row mapping below it, beside `trace_id`:

```ts
			session_id: row.session_id ?? "",
			turn_index: Number(row.turn_index ?? 0),
```

Add `session_id` and `turn_index` to `ClickHouseSpanRow` (`apps/core/src/services/logger/types.ts:261`), typed the way its neighbours are — ClickHouse returns numerics as strings under this client, which is why the mapping above calls `Number(...)`. Update the doc comment above the function to say it reads a session.

- [ ] **Step 5: Update every caller of the old name**

Run `grep -rn "getTraceSpans" apps/core/src` and rename each call. The identifier they pass is already the session (the wire's `traceId`), so no call site changes its argument — only the function's name.

- [ ] **Step 6: Run everything**

Run: `pnpm turbo run test:run --filter=core`, `pnpm turbo run type-check --filter=core`, `pnpm turbo run test:run --filter=web`, `pnpm --filter web build`
Expected: all PASS and clean.

- [ ] **Step 7: Commit**

```bash
git add apps/core/src/services/logger/queries.ts apps/core/src/services/logger/logger.ts apps/core/src/services/logger/types.ts apps/core/src/services/logger/queries.test.ts
git commit -m "feat(trace): read a session across the traces of its turns"
```

---

## Self-Review

**Spec coverage.** Decision 1 (four levels) → Tasks 1, 3, 4. Decision 2 (absent session id) → Tasks 1 and 5. Decision 3 (one batch at turn end) → Tasks 3 and 4. Decision 4 (conventions' vocabulary) → Task 2. Decision 5 (`user` stays internal) → Task 2, which keeps `user` and documents why it has no counterpart. Decision 6 (turn structure derived from steps) → nothing to implement: `turnsOf`, `expectedSteps`, replay and comparison are untouched by design, and Task 4 consumes `turnsOf` rather than reproducing it. Decision 7 (`logs` untouched) → enforced by the Decisions block; no task modifies `logs` or `queries.ts`'s analytics.

**Gap found and closed.** The spec says `logs` is untouched but does not say what `logs.trace_id` holds once a trace is a turn. It holds the session, unchanged — recorded in the Decisions block, because a per-turn value there would silently break the trajectory cost sum at `services/logger/types.ts:31`.

**Gap found and closed.** The spec does not mention that `spansToSteps` must strip the `execute_tool ` prefix from a tool span's name. Without it every testcase pinned from a new-vocabulary trace stops at `missing_recording`, because replay matches a recorded call by name. Task 2, Steps 4-5.

**Placeholder scan.** No TBD, no "add error handling", no "similar to Task N". Two steps deliberately defer to existing code rather than inventing structure — Task 4 Step 1 and Task 3 Step 1's controller test say "use the harness this file already has". That is an instruction to follow a pattern, not a missing decision: inventing a second mocking style in a file that has one is the defect, not the fix.

**Type consistency.** `finishedTurnSteps` is named identically in Task 3's interface block, its implementation and the controller call. `SpanBatch` fields `session_id` / `turn_index` are spelled snake_case everywhere, matching the row's other fields; the returned ordinal is `turnIndex` (camelCase) because it is a TypeScript value, not a column. `getSessionSpans` is used in Tasks 5's interface block and its steps.

**Out of scope, deliberately.** Deduplication, deterministic span ids and the table engine — queued by the ingest work, noted in the spec's storage section. The OTLP receiver. Whether a plainly-answered first turn seeds a session, which is a product decision and changes nothing structural here.
