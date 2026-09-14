# OTLP Trace Ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept a customer's OpenTelemetry traces at `POST /api/public/otel/v1/traces` and store them as sessions Genum can read and pin as testcases.

**Architecture:** The mapping from OTLP to our rows is a pure function with no database in it, so the whole risky part is testable; the controller is thin. Auth reuses the existing `/api/v1` Bearer-key path. No table is rewritten — dedup happens on read.

**Tech Stack:** Node/Express/TypeScript, ClickHouse (append-only), Prisma/PostgreSQL for keys, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-otlp-ingest-design.md`, which builds on
`2026-09-09-agentic-session-model-design.md` and `2026-09-09-otlp-ingest-open-questions.md`.
Read the first before Task 1. Its S1-S6 are binding.

## Global Constraints

- **ClickHouse is append-only for these rows.** Nothing may rewrite, backfill or delete an
  existing row. No task in this plan changes a table engine — that was considered and
  rejected in the spec; if a task seems to need it, stop and report.
- Never edit `apps/core/src/.generated/`.
- Run core tests through turbo: `pnpm turbo run test:run --filter=core`. `pnpm --filter core
  test:run` fails on a never-built tree.
- Type-check with `pnpm turbo run type-check --filter=core`.
- Biome: tabs, indent width 4, line width 100, LF. Lint and format are red repo-wide; judge
  only the files you touch, and format them yourself — no pre-commit hook runs.
- Single `.env` at the repo root. Never create one in a subfolder.
- `logs.trace_id` is session-scoped and stays that way: trajectory cost is
  `sum(cost) WHERE log_type IN ('prs','prt') AND trace_id = ...`. Ingest writes no `logs`
  rows at all (S: ingested traces are not metered), so nothing here touches that query.
- The wire vocabulary says "trace" where it means a session (`/traces/:traceId/spans`,
  `getTraceSpans`). That is deliberate and documented; do not rename it.
- A test that passes against the implementation it claims to exclude guards nothing. Where
  a task names a wrong implementation, confirm the test fails against it first.

## Baseline

At `cc7322a`: core **738 tests / 70 files**, web **86 / 6**, both green. Core counts must
rise; web must not change — no task here touches `apps/web`.

## File Structure

**Created**
- `apps/core/clickhouse/migrations/20260910120000_span_source.sql` — the `source` column.
- `apps/core/src/services/otlp/mapSpans.ts` — OTLP JSON → `SpanRow[]`. Pure.
- `apps/core/src/services/otlp/mapSpans.test.ts`
- `apps/core/src/services/otlp/types.ts` — the OTLP JSON shapes we read.
- `apps/core/src/controllers/otlp.controller.ts`
- `apps/core/src/routers/OtlpRouter.ts`
- `apps/core/src/auth/apiKey.ts` — the shared Bearer-key resolution (S1).

**Modified**
- `apps/core/src/services/logger/spans.ts` — `source` on `SpanRow`; derived `span_id` (S4).
- `apps/core/src/services/logger/queries.ts` — `LIMIT 1 BY (trace_id, span_id)`.
- `apps/core/src/controllers/apiv1.controller.ts` — uses the shared helper.
- `apps/core/src/routes.ts` — mounts the new router.

---

### Task 1: Shared API-key resolution

**Files:**
- Create: `apps/core/src/auth/apiKey.ts`
- Modify: `apps/core/src/controllers/apiv1.controller.ts` (`verifyRequest`, around line 28)
- Test: `apps/core/src/auth/apiKey.test.ts`

**Interfaces:**
- Consumes: `extractBearerToken` from `@/utils/http` (confirmed), plus
  `db.project.getProjectApiKeyByToken` and `db.project.getProjectbyApiKeyById`.
- Produces: `resolveApiKey(authorizationHeader: string | undefined): Promise<{ project, key }>`,
  throwing `HttpError` 401/404 exactly as `verifyRequest` does today.

S1. One key path, not two: a second one is how one of them ends up missing a revocation
check that the other got.

- [ ] **Step 1: Read `apiv1.controller.ts:28-47`** — the block being moved. Preserve its
      status codes and messages verbatim; they are a public API's contract.

- [ ] **Step 2: Write the failing tests** — mock `db.project`, then assert: a missing
      header throws 401 with the existing message; an unknown token throws 401; a key whose
      project is gone throws 404; a good token returns `{ project, key }`.

- [ ] **Step 3: Run them, watch them fail** (`pnpm turbo run test:run --filter=core`).

- [ ] **Step 4: Implement `resolveApiKey`**, then make `verifyRequest` delegate to it and
      keep nothing but the call.

- [ ] **Step 5: Tests pass, and the existing apiv1 tests still pass unchanged.** If an
      apiv1 test breaks, you changed behaviour — revert and move only the code.

- [ ] **Step 6: Format and commit.**

---

### Task 2: `source`, and a span id worth deduplicating on

**Files:**
- Create: `apps/core/clickhouse/migrations/20260910120000_span_source.sql`
- Modify: `apps/core/src/services/logger/spans.ts`
- Test: `apps/core/src/services/logger/spans.test.ts`

**Interfaces:**
- Produces: `SpanRow.source: "genum" | "otlp"`; `deriveSpanId(traceId, spanIndex)`;
  `SpanBatch.source` defaulting to `"genum"`.

Two things the quota decision and the dedup decision each depend on.

- [ ] **Step 1: Write the migration**

```sql
-- Ingested rows must say they were ingested. `trace_spans` is append-only, so a row that
-- does not record where it came from can never be made to: without this column, "ingested
-- traces are not metered for now" is not a decision anyone can revisit, because no later
-- query could separate a customer's traces from our own runs.
--
-- Defaulted rather than nullable: every row written before this one is ours, so 'genum' is
-- not a guess about them, it is a fact.
ALTER TABLE {{DB_NAME}}.trace_spans
    ADD COLUMN IF NOT EXISTS source LowCardinality(String) DEFAULT 'genum';
```

- [ ] **Step 2: Write the failing tests for `deriveSpanId`**

```ts
describe("deriveSpanId", () => {
	it("is stable for the same trace and span index, so a retried write collapses", () => {
		// The whole point. Dedup is on (trace_id, span_id): against `randomUUID()` the
		// retry writes a NEW span_id, nothing matches, and the duplicate is permanent in
		// an append-only table. `deriveTurnTraceId` already made the trace id stable;
		// this finishes the pair.
		expect(deriveSpanId("trace-1", 0)).toBe(deriveSpanId("trace-1", 0));
	});

	it("differs across span indices in one trace", () => {
		expect(deriveSpanId("trace-1", 0)).not.toBe(deriveSpanId("trace-1", 1));
	});

	it("differs across traces at the same index", () => {
		expect(deriveSpanId("trace-1", 0)).not.toBe(deriveSpanId("trace-2", 0));
	});
});

describe("toSpanRows", () => {
	it("writes the same rows twice for the same batch", () => {
		// What a retry looks like. Every field must match, span ids included.
		const batch = { /* the file's baseBatch */ steps };
		expect(toSpanRows(batch)).toEqual(toSpanRows(batch));
	});

	it("marks our own rows as ours", () => {
		expect(toSpanRows({ ...baseBatch, steps })[0].source).toBe("genum");
	});
});
```

- [ ] **Step 3: Run them and watch them fail.** The stability test fails against today's
      `randomUUID()` — confirm that specific failure before implementing, and report it.

- [ ] **Step 4: Implement.** `deriveSpanId` mirrors `deriveTurnTraceId` in the same file:
      SHA-256 of `` `${traceId}:${spanIndex}` `` rendered into a valid v5-shaped UUID.
      Reuse that function's UUID-stamping — do not copy the nibble arithmetic; extract it
      into a small local helper both call, so the two ids cannot drift into different
      formats. Add `source` to `SpanRow` and to `toSpanRows`, defaulting from
      `batch.source ?? "genum"`.

- [ ] **Step 5: Apply the migration locally** and confirm the column exists:
```bash
docker exec genum-clickhouse clickhouse-client --query "DESCRIBE genum.trace_spans" | grep source
```
      A migration that has never run is a migration that silently does nothing — this
      exact failure already happened once on this branch, and span writes were failing in
      silence because `logSpans` catches and logs.

- [ ] **Step 6: Tests pass, type-check clean, format, commit.**

---

### Task 3: A session read that hides duplicates

**Files:**
- Modify: `apps/core/src/services/logger/queries.ts` (`GET_SPANS`)
- Test: `apps/core/src/services/logger/queries.test.ts` (or wherever `GET_SPANS` is asserted)

**Interfaces:** consumes nothing new; changes SQL text only.

- [ ] **Step 1: Read the existing query and its test.** It currently ends
      `ORDER BY turn_index ASC, span_index ASC LIMIT {limit: UInt64}`.

- [ ] **Step 2: Write the failing test** asserting the emitted SQL contains
      `LIMIT 1 BY (trace_id, span_id)` and still orders by `turn_index, span_index`.
      There is no ClickHouse in the suite, so asserting SQL text is the honest test here —
      say so in a comment, since an assertion on a string otherwise looks lazy.

- [ ] **Step 3: Add the clause**, placed after `ORDER BY` and before the row `LIMIT`:

```sql
ORDER BY turn_index ASC, span_index ASC
LIMIT 1 BY (trace_id, span_id)
LIMIT {limit: UInt64}
```

      With a comment saying what it is for: OTLP delivers at least once, so the same span
      can be stored twice; this makes the duplicate invisible from the moment it lands,
      without rewriting the table.

- [ ] **Step 4: Tests pass, format, commit.**

---

### Task 4: OTLP JSON to rows

**Files:**
- Create: `apps/core/src/services/otlp/types.ts`, `apps/core/src/services/otlp/mapSpans.ts`
- Test: `apps/core/src/services/otlp/mapSpans.test.ts`

**Interfaces:**
- Consumes: `SpanRow` from `@/services/logger/spans`.
- Produces: `mapOtlpSpans(payload, context): { rows: SpanRow[]; rejected: number; reasons: string[] }`
  where `context` is `{ orgId, projectId, defaultPromptId }`.

The heart of the feature, and pure: no database, no Express, no clock. Everything that can
be got wrong about the mapping is testable here.

- [ ] **Step 1: Read the spec's mapping table.** It is the requirement. Also read
      `SpanRow` in `apps/core/src/services/logger/spans.ts` for the target shape.

- [ ] **Step 2: Write the failing tests**, one per row of that table plus these:

  - a span with `gen_ai.conversation.id` gets it as `session_id`; one without gets `""`
    (a session of one trace — never invent a conversation id, the conventions forbid it)
  - `cost` is 0 and `source` is `"otlp"` on every row, always
  - an unmodelled `gen_ai.operation.name` is kept as its own `span_type`, not refused
  - `genum.prompt.id` wins over the context's default; absent, the default is used
  - a span with neither, and no default, is rejected with a reason and no row
  - `startTimeUnixNano` (a string of nanoseconds) becomes a millisecond timestamp
  - ids are passed through verbatim — a 16-hex span id stays 16 hex, not re-encoded (S4)
  - `parentSpanId` is stored, and an empty one becomes null (S3)
  - a `user` step is derived from the last user-role entry of `gen_ai.input.messages` for
    a turn that is not the first, and NOT for the first (S2); absent attribute means no
    `user` step and no error

- [ ] **Step 3: Run them and watch every one fail.**

- [ ] **Step 4: Implement `mapOtlpSpans`.** Notes that will otherwise cost you an hour:
      OTLP JSON nests as `resourceSpans[].scopeSpans[].spans[]`; attributes are an array of
      `{key, value: {stringValue|intValue|boolValue|arrayValue}}`, not an object, so write
      one `attr(span, key)` reader and use it everywhere; `intValue` arrives as a *string*
      in JSON because it is an int64. Reject a span rather than guessing when the prompt
      cannot be resolved, and collect reasons rather than throwing — the endpoint reports
      partial success.

- [ ] **Step 5: Tests pass. Prove the S2 test discriminates** by making the derivation run
      for the first turn too; the "not for the first" test must fail. Restore, re-run,
      report both outcomes.

- [ ] **Step 6: Format and commit.**

---

### Task 5: Ordering a session's turns on arrival

**Files:**
- Create: `apps/core/src/services/otlp/turnIndex.ts` + test
- Modify: `apps/core/src/services/logger/logger.ts` (a read for a session's known traces)

**Interfaces:**
- Produces: `assignTurnIndices(traces: {traceId, earliestTimestamp}[], alreadyStored: string[]): Map<string, number>`

S5, and the least reversible decision in the feature — `turn_index` cannot be renumbered.

- [ ] **Step 1: Write the failing tests**

  - two traces in one batch are numbered by earliest timestamp, ascending
  - equal timestamps break the tie by trace id, so the numbering is stable across retries
  - a trace already stored keeps its place: new traces start after `alreadyStored.length`
  - a batch whose traces are all already stored assigns nothing new
  - a single trace with no session gets index 0

- [ ] **Step 2: Run them, watch them fail. Step 3: Implement. Step 4: Tests pass.**

- [ ] **Step 5: Add the lookup** — a function on the logger service returning the distinct
      `trace_id`s already stored for a `session_id`. One query, `SELECT DISTINCT trace_id
      ... WHERE session_id = {session:String}`, parameterised (never interpolated).

- [ ] **Step 6: Format and commit.**

---

### Task 6: The endpoint

**Files:**
- Create: `apps/core/src/controllers/otlp.controller.ts`, `apps/core/src/routers/OtlpRouter.ts`
- Modify: `apps/core/src/routes.ts`
- Test: `apps/core/src/controllers/otlp.controller.test.ts`

**Interfaces:** consumes everything above.

- [ ] **Step 1: Mount the router where JWT cannot reach it.** Confirmed in the pre-flight
      scan: `routes.ts` applies `app.use(checkJwt)` at **line 32**, and every public
      surface is mounted above it — `/auth/local` (21), `/auth` (22), `/admin` (23),
      `/api/v1` (26), `/service/mail` (29). The new router goes in that block, **above line
      32**. Mounted below it, every request from a customer's collector gets a 401 for
      want of a JWT it has no way to have, and the failure looks like a bad API key.

- [ ] **Step 2: Write the failing tests** (mock `logSpans` and the logger read):

  - no `Authorization` header → 401, and `logSpans` not called
  - a valid batch → 200, `logSpans` called with rows carrying `source: "otlp"`
  - the same batch twice → `logSpans` called twice with **identical** rows (dedup is the
    read's job, not the endpoint's — this pins that the endpoint does not silently drop)
  - a batch with one unresolvable-prompt span → 200 with `partialSuccess.rejectedSpans: 1`,
    and the other span still written
  - a batch where NO span resolves a prompt → 400, nothing written
  - malformed JSON body → 400

- [ ] **Step 3: Run them, watch them fail. Step 4: Implement.** The controller is thin:
      resolve the key (Task 1), map (Task 4), assign turn indices (Task 5), write via
      `logSpans`, answer with OTLP's partial-success shape. Register the router in
      `routes.ts` at `/api/public/otel/v1/traces`.

- [ ] **Step 5: Verify end to end against the local stack**, which is the only way to learn
      that the column, the query and the writer agree:

```bash
curl -s -X POST http://localhost:3010/api/public/otel/v1/traces \
  -H "Authorization: Bearer <a real project key>" \
  -H "Content-Type: application/json" \
  --data @apps/core/src/services/otlp/__fixtures__/one-turn.json
docker exec genum-clickhouse clickhouse-client --query \
  "SELECT source, trace_id, span_id, turn_index, cost FROM genum.trace_spans WHERE source='otlp' LIMIT 5 FORMAT Vertical"
```

      Then send the identical payload again and confirm the session read returns each span
      once. Paste both outputs into your report.

- [ ] **Step 6: All four green, format, commit.**

```
pnpm turbo run test:run --filter=core
pnpm turbo run type-check --filter=core
pnpm turbo run test:run --filter=web
pnpm --filter web build
```

---

## Self-review notes

- **Spec coverage:** S1 → Task 1. S2 → Task 4 (with a discrimination step). S3 → Task 4.
  S4 → Task 2 (span id) and Task 4 (verbatim ingested ids). S5 → Task 5. S6 → no code, by
  design. `source` and the quota decision → Task 2. Read-side dedup → Task 3.
- **No task changes a table engine or rewrites a row.** The one destructive option was
  considered in the spec and rejected; if an implementer proposes it, that is a spec
  question, not a task decision.
- **Two tasks carry a "prove it discriminates" step** (2 and 4), both on rules whose wrong
  implementation looks right on a tidy example.
- **`apps/web` is untouched** by every task here. Its test count must not move.
