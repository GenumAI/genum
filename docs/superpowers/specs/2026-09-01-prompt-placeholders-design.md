# Prompt placeholders

**Date:** 2026-09-01

## Goal

Let a prompt author put named holes in the prompt text — `{{admin_role}}` — and define, per hole,
a small set of named values, each carrying a block of instruction text. The caller picks one value
per hole at run time; the rest of the prompt is unchanged. A hole whose value is not picked falls
back to the value the author marked as default.

The blocks are instruction text, so they are logic, so they are committed with the prompt, recorded
on every run, and pinned by testcases.

`Memory` is deleted. Its keys become the values of a single placeholder named `memory_key`.

## What exists today

`Memory` is a `{key, value}` pair scoped to one prompt
(`apps/core/prisma/models/prompt.prisma:101`, `@@unique([key, promptId])`), and the run appends its
value to the end of the instruction:

```ts
// apps/core/src/ai/runner/run.ts:154
let memoryKey: string | undefined;
if (data.memoryId !== undefined) {
    const memory = await db.memories.getMemoryByIDAndPromptId(data.memoryId, prompt.id);
    ...
    instruction += memory.value; // add memory value to prompt
    memoryKey = memory.key;
}
```

So there is no position: one key means one tail. It reaches the rest of the system as a **string
name**, not an id — the run log carries `memory_key Nullable(String)`
(`apps/core/clickhouse/init.sql:30`, written at `logger.ts:194`, read at `logger.ts:159`), the public
API takes `memoryKey` (`apps/core/src/services/validate/types/apiv1.type.ts:15`, resolved to an id at
`apiv1.controller.ts:119`), a testcase pins one through `TestCase.memoryId`
(`apps/core/prisma/models/testcase.prisma:18`, `onDelete: SetNull`), and "add testcase from log"
matches the log's string back onto a memory row **in the browser**
(`apps/web/src/pages/prompt/playground-tabs/logs/hooks/useAddTestcaseFromLog.ts:33`).

The gap this design closes: **memory is not versioned.** A commit freezes `value`,
`languageModelConfig` and `languageModelId` (`PromptVersion`, `prompt.prisma:79`), and a productive
run reads exactly those three back (`PromptService.getPromptWithProductiveCommit`,
`prompt.service.ts:171`, over `getProductiveCommit` = newest commit on branch `master`,
`PromptsRepository.ts:681`). The memory tail is read live. A `productive: true` caller therefore gets
committed text glued to uncommitted instruction — which is the defect, because that tail is where the
conditional logic lives.

## Decisions

Settled in brainstorming, recorded because each one closes off a different design:

1. **A placeholder belongs to a prompt**, exactly as `Memory` does. Not to the project: a shared
   value edited in one place would silently change the behaviour of other prompts' *committed*
   versions, which is the very thing this design exists to prevent.
2. **Values are enumerated by the author.** A caller picks a value by name; it can never pass block
   text. Free text would put the logic back outside Lab and leave nothing to commit.
3. **One key takes exactly one value.** `{{admin_role}}` is a switch with N positions.
4. **The default is an explicit flag on one value**, not "empty". A placeholder may legally have no
   default; then an unselected key renders as nothing and is logged as empty.
5. **Substitution is strictly positional.** A selected value whose `{{key}}` does not appear in the
   text is *ignored* — never appended. This is the one decision that breaks bug-compatibility with
   memory, and §Migration deals with the consequence.
6. **Committed as a snapshot** on `PromptVersion`, alongside the text it belongs to.
7. **`memoryKey` survives in the public API as a deprecated alias.** `RunPromptSchema` is `.strict()`,
   so dropping the field would answer an existing integrator with a 400, not a degradation.

## Data model

Three new models; `Memory` is dropped.

```prisma
model Placeholder {
    id          Int     @id @default(autoincrement())
    key         String  @db.VarChar(255)   // "admin_role", "memory_key"
    description String?                    // author's note; never sent to the model
    promptId    Int
    prompt      Prompt  @relation(fields: [promptId], references: [id], onDelete: Cascade)
    values      PlaceholderValue[]
    createdAt   DateTime @default(now()) @db.Timestamp(6)
    updatedAt   DateTime @default(now()) @updatedAt @db.Timestamp(6)

    @@unique([key, promptId])
}

model PlaceholderValue {
    id            Int         @id @default(autoincrement())
    placeholderId Int
    placeholder   Placeholder @relation(fields: [placeholderId], references: [id], onDelete: Cascade)
    name          String      @db.VarChar(255)  // "true", "false", "client_bmw"
    content       String                        // the block; "" is a legal value
    isDefault     Boolean     @default(false)
    createdAt     DateTime    @default(now()) @db.Timestamp(6)
    updatedAt     DateTime    @default(now()) @updatedAt @db.Timestamp(6)

    testCases     TestCasePlaceholderValue[]

    @@unique([placeholderId, name])
}

model TestCasePlaceholderValue {
    testCaseId         Int
    placeholderId      Int               // denormalised on purpose — see below
    placeholderValueId Int

    testCase         TestCase         @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
    placeholderValue PlaceholderValue @relation(fields: [placeholderValueId], references: [id], onDelete: Cascade)

    @@id([testCaseId, placeholderValueId])
    @@unique([testCaseId, placeholderId])
}
```

`PromptVersion` gains `placeholders Json?` — the committed snapshot, in the shape
`renderPlaceholders` already consumes, so the run path needs no adapter:

```jsonc
[{ "key": "admin_role",
   "values": [{ "name": "false", "content": "",    "isDefault": true },
              { "name": "true",  "content": "...", "isDefault": false }] }]
```

Committing snapshots the prompt's live placeholders into that column in the same write that stores
`value`; `null` means a version committed before this feature, and renders as "no definitions".

`Prompt.memories` becomes `Prompt.placeholders`; `TestCase.memoryId` / `TestCase.memory` are removed
and `TestCase` gains the back-relation `placeholderValues TestCasePlaceholderValue[]`.

Two constraints carry the invariants rather than leaving them to code:

- **`placeholderId` is duplicated onto the join row** so that `@@unique([testCaseId, placeholderId])`
  can exist. Without it, "one key, one value" is not expressible in the database and a testcase
  holding both `admin_role=true` and `admin_role=false` becomes representable.
- **At most one default per placeholder** — a partial unique index, which Prisma cannot express, so a
  raw statement in the migration:

  ```sql
  CREATE UNIQUE INDEX "PlaceholderValue_one_default_per_placeholder"
      ON "PlaceholderValue" ("placeholderId") WHERE "isDefault";
  ```

  Without it, "the default" silently becomes "whichever row came back first".

Deleting a `PlaceholderValue` cascades its join rows away, which is the `onDelete: SetNull` behaviour
`TestCase.memoryId` has today: the testcase survives, its selection does not.

No new relation is added to `model User`, so the closed-world erasure guard
(`apps/core/src/erasure/user-relations.test.ts`) is untouched.

## Rendering

One pure module, no database, next to the runner. It is the only place that knows the syntax:

```ts
type PlaceholderDefinition = {
    key: string;
    values: { name: string; content: string; isDefault: boolean }[];
};

type RenderResult = {
    text: string;
    resolved: Record<string, string | null>; // key -> chosen value name, per key found in the text
    ignored: string[];                        // selected keys with no {{key}} in the text
    undefinedKeys: string[];                  // {{key}} in the text with no definition
};

function renderPlaceholders(
    text: string,
    definitions: PlaceholderDefinition[],
    selection: Record<string, string>,
): RenderResult;
```

Rules:

1. For each definition, the chosen value is `selection[key]` matched by name; failing that the value
   with `isDefault`; failing that nothing — the block renders as the empty string and `resolved[key]`
   is `null`.
2. **Every** occurrence of `{{key}}` is replaced, not the first.
3. A selection for a key absent from the text is ignored and listed in `ignored`. It is surfaced —
   in the API response and in the playground — because silently dropping a value the caller passed is
   how a typo becomes a quality complaint instead of an error.
4. `{{key}}` with no definition is left **verbatim** and listed in `undefinedKeys`. Stripping it would
   destroy text the author typed; the UI flags it instead.

The detector — pulling `{{key}}` out of a text — is the same module, exported separately
(`detectPlaceholderKeys`). The playground chips, the Placeholders tab and the runtime all call it, so
the UI cannot promise something the runtime does not do.

`renderPlaceholders` is called in `runPrompt` where `instruction += memory.value` stands today
(`run.ts:154-162`), before `mdToXml`.

## Which definitions apply

The same fork as the text, decided in one place:

- `productive: true` — from `PromptVersion.placeholders`. `getPromptWithProductiveCommit`
  (`prompt.service.ts:171`) starts substituting a fourth field, so text and definitions always come
  out of the same commit object. Anything else re-creates the very drift this design removes.
- Playground and testcase runs — from the live tables.

## Migration

One Prisma migration, four steps.

1. Create the three models, add `PromptVersion.placeholders`, add the partial unique index.
2. Backfill in SQL: for every prompt that owns memories, one `Placeholder{key: "memory_key"}`; for
   every `Memory` row, one `PlaceholderValue{name: memory.key, content: memory.value}`. **No value is
   marked default.** Today, not passing `memoryKey` appends nothing, and a placeholder with no default
   reproduces exactly that; inventing a synthetic `none` value would pollute the selector and every
   log line.
3. Backfill `TestCasePlaceholderValue` from `TestCase.memoryId`, then drop the column and the `Memory`
   table.
4. Append `\n\n{{memory_key}}` to `Prompt.value` for every prompt that owned memories.

Step 4 is the consequence of decision 5 and deserves its argument. After the migration an old
*committed* version has no `{{memory_key}}` in it, so its memory block stops being appended. Rewriting
`PromptVersion.value` is not an option — that is forging history, and the commit is what a productive
run reads. `Prompt.value` is not history: it is the working draft. Appending the marker there restores
**exactly** today's behaviour (memory was appended at the end anyway), puts it in front of the author
in the editor where it can be moved or deleted, and leaves production on the old commit until the
author decides to commit. Nothing changes behind their back; the change becomes theirs to make.

The migration must also **report** which prompts owned memories and whose productive commit lacks
`{{memory_key}}` — those run without their block until re-committed. Without the list, a silently
missing instruction block is discovered through answer quality rather than through a deploy log.

## Logs

`clickhouse/init.sql` is executed with `CREATE TABLE IF NOT EXISTS` on every init and has no migration
framework, so the new column arrives as an idempotent statement in the same file:

```sql
ALTER TABLE {{DB_NAME}}.logs
    ADD COLUMN IF NOT EXISTS placeholders Map(LowCardinality(String), LowCardinality(String));
```

`memory_key` stays for the rows that already have it and is never written again. ClickHouse is
append-only; an `ALTER UPDATE` over the whole log table to rewrite history is a heavy, asynchronous,
irreversible operation on a live instance, and it buys nothing a read-time branch does not.

**Write:** every key found in the rendered text is recorded — the chosen value's name, or the empty
string where `resolved` holds `null` (a ClickHouse `Map` has no null value, and an absent entry would
be indistinguishable from a key that was not in the text at all). Not just what the caller passed: one
log line should answer both which knobs existed on that run and how they stood.

**Read:** `mappers.ts` coalesces — an empty map plus a non-null `memory_key` is presented as
`{memory_key: X}`. Old logs stay usable, and exactly one place in the reading code branches.

## Testcases and "add testcase from log"

A testcase pins a selection through the join table. `createTestcase` / `updateTestcase` accept
`placeholders: Record<key, valueName>`, resolve each name **within that prompt**, and return the names
that could not be resolved.

Resolution moves from the browser to the server. Today `useAddTestcaseFromLog.ts:33` does
`memoriesData.find(item => item.key === selectedLog.memory_key)` and silently drops the selection when
it misses. Server-side resolution also carries the existing tenancy guard over: `memoryId` was
writable through the update schema and had to be validated against the prompt
(`testcase.controller.ts:92-99`, and the regression test "refuses a memory belonging to another
prompt"). That check must exist for placeholder values or it is lost with the column it guarded.

The client shows what did not transfer in a toast instead of nothing.

## Public API

```ts
export const RunPromptSchema = z.object({
    ...,
    placeholders: z.record(z.string(), z.string()).optional(), // { admin_role: "true" }
    memoryKey: z.string().optional(),                          // deprecated
}).strict();
```

A pure adapter merges them: `memoryKey: "X"` becomes `{ memory_key: "X" }`, and an explicit
`placeholders.memory_key` wins when both arrive. Downstream code sees one shape; the legacy branch
exists in the adapter and nowhere else.

The response gains `placeholders: { resolved, ignored }`. `ignored` is the point: we decided a key not
present in the text is dropped, and an integrator who never hears about it debugs a model quality
problem instead of a typo. `resolved` gives the same map that reaches the log without a trip to
ClickHouse.

## UI

**Playground — chips under the System Instructions editor.** `{{key}}` occurrences are highlighted in
the editor, and under it sits one chip per detected key: `admin_role: true ▾`, opening a popover of
that key's values with the default marked. A key in the text with no definition renders as a red chip
that offers to create it. The chips are computed from the **live** draft (`livePromptValue` in
`usePlaygroundPrompt.ts:36`), not the saved prompt, so they appear as the author types.

This placement is what makes decision 5 legible: a chip exists exactly when its `{{key}}` is in the
text, so "a value with no hole is ignored" is visible rather than a surprise at run time. Long chip
rows collapse behind a `+N`.

The selection lives in the playground Zustand store, replacing `selectedMemoryId` /
`selectedMemoryKeyName` (`apps/web/src/stores/playground.store.ts:7-8`) with a
`Record<key, valueName>` per prompt. `MemoryKey` is removed from the Output header
(`OutputHeader.tsx:42`) — the run state belongs next to the text it modifies, not next to the answer.

**Placeholders tab — master–detail**, replacing the Memory tab. Keys on the left with their value
count and whether they occur in the text; the selected key's values on the right, each with a
full-width editor for its block. Block texts are chunks of a system prompt and do not fit the modal
that `Memory` uses today. Deleting a value states how many testcases pin it before the delete, not
after.

`useTestcasesColumns.tsx:100` swaps its `memoryKey` column for the selection.

## Testing

Vitest in core runs without a database (`pnpm --filter core test:run`), so everything load-bearing is a
pure function — otherwise it is untested by construction.

- `renderPlaceholders`: all occurrences replaced; default applied when unselected; empty text and a
  `null` in `resolved` when there is no default; a selection off the text lands in `ignored`; an
  undefined `{{key}}` stays verbatim and lands in `undefinedKeys`.
- **Memory parity:** a prompt whose text ends in `{{memory_key}}` renders byte-for-byte what
  `instruction += memory.value` produced. This is what demonstrates the migration is faithful.
- `detectPlaceholderKeys`: extraction, de-duplication, order.
- Log mapper: empty map plus `memory_key` reads back as `{memory_key: X}` (fits the existing
  `mappers.test.ts`).
- API adapter: `memoryKey` folds into `memory_key`; an explicit `placeholders` entry wins.
- Testcase controller over a mocked `db`: a value belonging to another prompt is refused — the port of
  the existing memory regression test.
- A productive run reads its definitions from the commit snapshot, not from the live tables.

## Out of scope

- Filtering logs by placeholder. There is no `memory_key` filter in `where.builder.ts` today either.
- Project-level shared placeholders (decision 1).
- Free-text placeholder values (decision 2).
- Several values for one key (decision 3).
- Moving the mail client's AI chat into Lab. It is what motivated dynamic instruction blocks, but it
  is a separate system — streaming, an agentic loop, and tools whose `execute` must stay in the mail
  app — and it gets its own spec.
