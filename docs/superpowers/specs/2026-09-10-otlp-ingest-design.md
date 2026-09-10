# Ingesting external traces over OTLP

**Status:** proposed, awaiting review
**Builds on:** `2026-09-09-agentic-session-model-design.md` (session / turn / step) and
`2026-09-09-otlp-ingest-open-questions.md` (the decisions already taken, including quota).

## What this is for

A customer already running an agent with OpenTelemetry instrumentation sends us their
traces. Each becomes a session in Genum, readable in the logs tab and pinnable as a
testcase — a real production conversation turned into a regression test, without them
writing a line of Genum-specific code.

The data model is already theirs: `trace_spans` uses the GenAI conventions' vocabulary
(`gen_ai.operation.name` values `chat` and `execute_tool`, span names `{operation}
{model|tool}`), a trace is one turn, and `session_id` groups a conversation. A conforming
span maps field to field. This document is about the endpoint, not the schema's shape.

## Already decided (see the open-questions doc)

One endpoint, `POST /api/public/otel/v1/traces`, authenticated by `ProjectApiKey`. Prompt
taken from a `genum.prompt.id` span attribute with a default on the key. Deduplication on
`(trace_id, span_id)`. Mismatched tools stored, not refused. Ingested usage displayed,
never summed. Prompt version is always the latest commit. **Ingested traces are not
metered and their cost is written as zero — and every ingested row must say it was
ingested, because `trace_spans` is append-only and a row that does not say so can never
be made to.**

## Decisions taken here

The five questions the open-questions doc left structural. Each is decided with what it
costs if the decision turns out wrong, because several of them write to an append-only
table and only some are reversible.

**S1. Auth reuses the existing public-API pattern, not a new one.** `/api/v1` already
authenticates `Bearer <token>` through `getProjectApiKeyByToken` and resolves the project
(`apiv1.controller.ts:28-47`). That block moves to a shared helper and both callers use
it. A second, parallel key path is how one of them ends up missing a revocation check.

**S2. The `user` step is derived from `gen_ai.input.messages`, and only for turns after
the first.** The conventions put a human reply in the chat span's input messages, not in a
span. The last `user`-role entry of turn N's input messages is what provoked turn N; turn
0's is the session's opening question, which is the testcase's `input` and never a step.
When the attribute is absent or holds no user entry, the turn simply gets no `user` step.

*Cost if wrong:* a multi-turn ingested testcase replays its second turn with no reply to
send and goes NOK. Visible in the run, not silent. The alternative — refusing the trace —
loses a session we could otherwise read, over a field that is optional in the spec.

**S3. Nested spans are stored flat, with `parent_span_id` kept.** A conforming sender may
emit a tree (a sub-agent, a chain, a retriever). The parent is recorded as sent; ordering,
display and replay ignore depth in this version and treat the turn as a flat step list.

*Cost if wrong:* a tree renders as a flat sequence, which reads oddly for a deep chain but
loses nothing — the depth is in the table, so a later UI can use it without a backfill.
This is the reversible choice, which is why it is the one taken.

**S4. Ingested ids are stored verbatim; ours become derived.** OTEL ids are 16 hex
characters for a span and 32 for a trace. The columns are `String` and take both. We do
not rewrite the sender's ids — an id we invented cannot be correlated with anything in
their system, which is the main reason they would look at this page at all.

Our own `span_id`, today `randomUUID()` per row, becomes derived from `(trace_id,
span_index)`. Dedup on `(trace_id, span_id)` is worthless against a random id: the retry
writes a new one and nothing collapses. This finishes the work `deriveTurnTraceId` started.

*Cost if wrong:* one column holds two id shapes forever. Any code that assumes a format,
or joins an ingested id to a generated one, is wrong — so no code may do either, and the
column's comment says so.

**S5. `turn_index` is assigned on arrival, from the traces already stored for the
session.** A trace new to a session takes the next ordinal after the distinct trace ids
already recorded for it; traces arriving together in one batch are ordered among
themselves by their earliest span timestamp, with trace id as a stable tie-break. Requires
one read before the write, which ingest can afford.

*Cost if wrong:* a turn delivered late, after a later turn already arrived, gets an
ordinal that puts it at the end of the conversation rather than in its true place — and
append-only means it cannot be renumbered. A session read then shows the turns in the
wrong order. This is the least reversible decision here and the one to revisit first if
real senders turn out to deliver out of order; timestamps are stored, so a read-side
reordering remains possible without touching the rows.

**S6. A session is never "complete".** Traces may arrive minutes apart, so a read returns
what has arrived. A testcase pinned from a half-delivered session pins what the author
saw — exactly the guarantee pinning from our own recording already gives. No completeness
flag, no waiting, no code.

## Schema

Two changes, both additive.

```sql
ALTER TABLE {{DB_NAME}}.trace_spans
    ADD COLUMN IF NOT EXISTS source LowCardinality(String) DEFAULT 'genum';
```

`source` is `'genum'` for our own runs and `'otlp'` for ingested ones. Defaulted rather
than nullable so every existing row reads as ours, which is what they are. This is the
column the quota decision depends on: without it, "not metered for now" is permanent.

Deduplication needs the engine to collapse duplicates:

```sql
-- ReplacingMergeTree keeps the last row per sorting key. The sorting key must therefore
-- END in span_id, so that two deliveries of the same span collapse and two different
-- spans never do.
```

A `MergeTree` cannot be altered into a `ReplacingMergeTree`, so this is a create-and-swap:
create `trace_spans_v2` with the new engine and ordering, copy, rename. **This is the only
destructive step in the feature and it is the one place the implementer must stop and ask
before running anything against a database that is not local.**

Collapsing is asynchronous, so reads must not assume it has happened: the session read
gets `LIMIT 1 BY (trace_id, span_id)`, which makes duplicates invisible immediately and
correct regardless of merge timing.

## The endpoint

`POST /api/public/otel/v1/traces`, accepting OTLP/HTTP JSON (`Content-Type:
application/json`). Protobuf is the more common encoding and is **out of scope here** —
the collector can be configured to send JSON, and adding protobuf later is a decoder, not
a redesign.

Mapping, per span:

| OTLP | `trace_spans` |
|---|---|
| `traceId` | `trace_id` |
| `spanId` | `span_id` |
| `parentSpanId` | `parent_span_id` |
| `startTimeUnixNano` | `timestamp` |
| `gen_ai.conversation.id` attr | `session_id` — absent means a session of one trace |
| `gen_ai.operation.name` attr | `span_type` |
| span `name` | `name` |
| `gen_ai.request.model` attr | `model` |
| `gen_ai.system` attr | `vendor` |
| `gen_ai.usage.input_tokens` | `tokens_in` (displayed, never summed) |
| `gen_ai.usage.output_tokens` | `tokens_out` |
| `genum.prompt.id` attr, else the key's default | `prompt_id` |
| — | `cost` = 0, `source` = `'otlp'` |

An operation we do not model is stored with its own `span_type` and rendered inertly
rather than refused — a span we cannot interpret is still a span the author may want to
see. A batch with no resolvable prompt is refused whole, with the reason: writing it under
a guessed prompt puts a customer's traces on someone else's page.

## Error handling

OTLP defines the response. A malformed batch is `400` with a message; an unknown or
revoked key is `401`; an unresolvable prompt is `400`. Partial success — some spans
accepted, some rejected — is expressed in the OTLP `partialSuccess` field rather than by
failing the batch, because a collector retries a failed batch whole and would resend the
spans that already landed. Dedup makes that harmless, but a `200` with a partial-success
count is what a collector is built to read.

## Testing

- The mapping table above, span by span, from a real OTLP JSON payload fixture.
- A batch delivered twice writes rows that read back once — the test that fails against
  a random `span_id`, which is what S4 exists to fix.
- Two turns of one `gen_ai.conversation.id` land in one session with ordinals 0 and 1.
- A span with no `gen_ai.conversation.id` becomes a session of one trace.
- An unmodelled `gen_ai.operation.name` is stored, not refused.
- A batch with no resolvable prompt is refused whole and writes nothing.
- Ingested rows carry `source = 'otlp'` and `cost = 0` — the test that pins the quota
  decision's one irreversible requirement.
- A `user` step is derived for turn 1 and not for turn 0 (S2).
- Our own writer's `span_id` is stable across two identical writes (S4).

## Out of scope

- OTLP protobuf encoding.
- Metrics and logs signals; this is traces only.
- Nested-span display and replay (S3 stores, does not render).
- Metering (decided: none) and rate limiting (the remedy if a key is abused, not needed
  until one is).
- Backfilling `source` for existing rows: they default to `'genum'`, which is correct.
