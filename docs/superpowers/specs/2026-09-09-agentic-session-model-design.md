# Agentic session model: sessions, turns and OTEL-shaped spans

**Status:** approved design, not yet implemented
**Date:** 2026-09-09
**Depends on:** [multi-turn agentic sessions](2026-09-08-multi-turn-agentic-sessions-design.md), [agentic tool testing](2026-09-03-agentic-tool-testing-design.md)
**Followed by:** [OTLP trace ingest — open questions](2026-09-09-otlp-ingest-open-questions.md)

## Why

`trace_spans` was named after the OpenTelemetry GenAI semantic conventions so that
ingesting external traces later would be "a mapping, not a rewrite". The implementation
then diverged from them in one structural way that makes that promise false.

**We store one trace per session. OTEL stores one trace per turn.** An external agent
instrumented to the conventions emits a trace per request and links them with
`gen_ai.conversation.id`; Langfuse, the closest comparable product, prescribes the same
shape explicitly — one trace per turn, one session per conversation — with the reasoning
that *you do not know upfront when a conversation ends*. Our model instead numbers every
step of a whole conversation in one sequence, which no external sender can produce.

That sequence is also the source of a defect class we have already paid for: because
`trace_spans` is append-only and a session is written turn by turn, each write must know
how many spans precede it (`spanIndexOffset`). A client that computed that number from a
conversation it had built wrongly wrote two spans onto one index, in a table where no row
can ever be corrected.

The goal of this design is that a session's structure be expressible in the conventions,
so that ingest is a rename of fields rather than an interpretation — and that the
cross-turn numbering, which exists only because we chose one trace per session, goes
away with the choice that created it.

A second, smaller motive: `final` is not final. A session has no terminal state, by
design and in agreement with the industry — the step is a *turn's answer*.

## What this is not

This design covers the model and the paths that write and read it. It does **not**
cover the OTLP receiver: the endpoint, protobuf decoding, sender authentication,
synthesising user steps from `gen_ai.input.messages`, matching a trace's tools against a
Genum prompt, or the behaviour on operations we do not model (`embeddings`, `retrieval`).
Those are recorded in the companion document and are a separate spec. This one is
self-sufficient: implemented alone, it changes how Genum's own runs are stored and read,
and nothing else.

## Standards position

The conventions are the shape of the **wire**, not a constraint on our internal normal
form. Two facts drive that split.

The GenAI conventions are still in Development status, and their agent and
tool-orchestration parts are explicitly described as unsettled; only chat and embeddings
are stable enough to build on. Binding our internal model to an unstable spec would trade
one rewrite for another.

And the conventions do not carry everything a replay engine needs. They have no ordinal
for a turn within a conversation — ordering there is by trace timestamp, which ties. Our
replay must be deterministic, so we materialise an ordinal ourselves.

The rule that follows, and that every decision below obeys: **anything we require from a
sender must exist in the conventions; anything we need beyond them we derive ourselves,
once, at the boundary.**

## Decisions

### 1. Four levels of identity

| Field | Meaning | Source |
|---|---|---|
| `session_id` | the conversation, however many turns | sender's `gen_ai.conversation.id`, or ours |
| `trace_id` | **one turn** | sender's trace id, or ours |
| `turn_index` | the turn's ordinal in the session, 0-based | **derived by us, never required** |
| `span_index` | the step's ordinal in the turn, 0-based | derived by us from order within the trace |

`span_index` restarts at zero in every turn. It is no longer a session-wide sequence,
and `spanIndexOffset` is deleted along with the arithmetic that maintained it.

`turn_index` is not a protocol field and is never demanded of a sender. It is computed
once, when a turn is written or ingested, and materialised so that turn order is
deterministic on read. Ordering by timestamp alone is not: two turns can share a
millisecond, and an ingested batch can arrive out of order.

For Genum's own runs, the server mints `session_id` on the first turn and returns it, and
every continuation echoes it back — exactly the mechanism `traceId` uses today, moved up
one level. `trace_id` is then minted per turn instead of per session. The client already
carries an identifier across a session's requests, so this is a change of which identifier
it carries, not a new obligation on it.

### 2. An absent session id is a session of one trace

The conventions state that an instrumentation without a real conversation identifier
MUST NOT invent one — not a UUID, not the trace id, not a hash of the request. So traces
will legitimately arrive with no session, and we must not manufacture it.

`session_id` is therefore nullable, and an empty `session_id` reads as *this trace is a
session by itself*. The same rule covers every row written before this change, where the
trace genuinely was the whole session. One rule, both cases, no backfill and no ClickHouse
mutation over history.

### 3. A turn's spans are written in one batch, when the turn ends

Today `logSpans` is called once per HTTP request, because the playground asks the author
for each tool result in a separate round trip. That is why an offset is needed at all.

A turn's spans are instead accumulated and written once, when the turn produces its
answer. Within one batch, indices start at zero and cannot collide with another writer's.

The cost is real and is accepted: **an abandoned turn records no spans.** An author who
starts a turn, types one tool result and leaves will have no `trace_spans` rows for it.
The `logs` rows are unaffected — they are still written per provider call, so no billed
turn and no token is lost. Only the step detail of an unfinished turn goes unrecorded,
and an unfinished turn is not pinnable as an expectation anyway.

The other writer of spans is a testcase run, which today hands `logSpans` the whole
replayed trajectory under one `trace_id`. It has the easier job of the two: a replay ends
knowing every turn it produced, so it writes one batch per turn — a shared `session_id`, a
fresh `trace_id` and an ascending `turn_index` each — in a single pass, and never needs an
offset either. Both writers therefore produce the same shape, and neither carries a
mechanism the other does not.

### 4. Span type and name follow the conventions

`span_type` carries `gen_ai.operation.name` values: `chat` and `execute_tool`, replacing
`llm` and `tool`. Span names follow `{operation} {model|tool}` — `chat gpt-4`,
`execute_tool getvisor` — replacing the bare model or tool name.

This is the cheap half of ingest compatibility: with it, a conforming span maps field to
field.

### 5. The `user` step stays internal

In the conventions a human reply is not a span; it is an entry in `gen_ai.input.messages`
on the chat span. Our `user` span has no counterpart and cannot be exported as one.

It stays, as our internal normal form, because the replay engine and the comparison need
the reply as an explicit, addressable step — that is what makes truncation a single rule
(`effectiveSteps`) and comparison per-turn. On ingest it is synthesised from a turn's
input messages rather than expected on the wire. On any future export it collapses back
into `gen_ai.input.messages`.

`span_type` keeps `user` as a third, Genum-only value, documented as such at its
declaration.

### 6. Turn structure stays derived from the steps, not from the storage

`turnsOf` splits a flat step list at `user` steps. That is unchanged, and it is what
makes the rest of this design cheap:

- **`expectedSteps` does not change.** Pinned expectations live in PostgreSQL as a flat
  list, and the turn boundaries are in the data, not in trace identity. No migration of
  any existing testcase.
- **Replay and comparison do not change.** Per-turn matching, truncation via
  `effectiveSteps`, the step budget, flat mismatch indices — all untouched.
- **Rows written before this change keep reading correctly.** An old session is one trace
  with a session-wide `span_index`; read as a single trace with `turn_index` 0, its steps
  come back in the same order, and `turnsOf` re-derives the same turns from the `user`
  steps inside them.

`final` is renamed to reflect what it is — a turn's answer, not a session's end — in the
UI copy and in this documentation. The **stored** discriminator stays `"final"`: it is
persisted inside `expectedSteps` and `lastSteps` JSON on every existing testcase, and a
rename of the wire value buys nothing that the label does not, at the price of a data
migration over user-owned rows.

### 7. `logs` and analytics are untouched

`log_type` keeps its meaning: `prs` opens a session, `prt` is a continuation turn. The
ten `countIf(log_type != 'prt')` positions and every cost and token SUM keep their current
semantics, and no denominator moves. Session grouping is expressed by `session_id`, which
is orthogonal to how turns are billed and counted.

## Storage

A ClickHouse migration adds two columns and widens nothing:

```sql
ALTER TABLE {{DB_NAME}}.trace_spans
    ADD COLUMN IF NOT EXISTS session_id String DEFAULT '',
    ADD COLUMN IF NOT EXISTS turn_index UInt16 DEFAULT 0;
```

`String DEFAULT ''` rather than `Nullable(String)`: every existing row then reads as
"no session", which decision 2 defines as a session of one trace, with no mutation over
history and no nullable column in the sort key's neighbourhood.

The sort key is **not** changed. `ORDER BY (orgId, project_id, trace_id, span_index)`
still serves the read below, because a session's traces are selected by `session_id` and
then ordered in the query. Changing a MergeTree sort key means rewriting the table, and
this design does not need it.

## Reading a session

`GET_SPANS` today selects the spans of one trace, ordered by `span_index`. It becomes a
session read:

```sql
SELECT *
FROM trace_spans
WHERE orgId = {orgId} AND project_id = {projectId}
  AND (session_id = {session} OR (session_id = '' AND trace_id = {session}))
ORDER BY turn_index ASC, span_index ASC
LIMIT {limit}
```

The disjunction is decision 2 in SQL: a session identifier addresses either rows that
carry it as their session, or the single trace that *is* that session — which covers
every row written before this change and every ingested trace that legitimately has no
conversation id.

`spansToSteps` on the web side does not change. It already takes a flat array of spans
and does not care how many traces produced it.

## Migration and compatibility

Nothing is rewritten and no history is mutated. Rows written before this change read as
one-trace sessions at `turn_index` 0, and their session-wide `span_index` orders them
exactly as it does today. New rows number from zero within each turn.

The two shapes never mix inside one session: a session either predates the change and has
one trace, or follows it and has one trace per turn. There is no session that is half of
each, because a session's traces are all written by the same code.

## Error handling

**A turn that fails before its answer** writes no span batch (decision 3). The failure is
already recorded as a `logs` row with its level and message; the trajectory pane shows the
turn as failed from that row, as it does now.

**A batch that fails to insert** is logged and swallowed, as `logSpans` does today: a
trace is diagnostic data, and losing it must not fail the user's run. The turn's `logs`
rows are written independently and still carry the billing.

**A session id that addresses nothing** returns no rows, and the caller renders the run
without a trajectory — the same path as a single-shot run today.

**A malformed or absent `turn_index` on read** (only reachable for rows written before
this change) sorts as 0, which is correct for them by decision 2.

## Testing

The rules that carry risk, and what pins each:

- **Numbering restarts per turn.** A three-turn session's rows are asserted as
  `(turn_index, span_index)` pairs: `(0,0) (0,1) (1,0) (2,0) (2,1) (2,2)`. The test must
  fail against a session-wide sequence — that is the defect being removed.
- **A turn is written once, whole.** A turn driven through several tool-result requests
  produces exactly one insert, of all its spans. Asserted on the insert call, not on the
  rows, so an implementation that writes incrementally and happens to produce the right
  rows still fails.
- **A testcase run writes one trace per replayed turn**, sharing one `session_id`, with
  `turn_index` ascending and each turn's `span_index` restarting at zero. The test must
  fail against the current single-trace write.
- **An abandoned turn writes no spans**, and its `logs` rows are still written.
- **The session read covers both shapes.** One test for a session of three traces, one
  for a pre-change row whose `session_id` is empty and whose `trace_id` is the session
  identifier; both come back in step order.
- **Old rows keep their turn grouping.** A pre-change session with `user` steps inside one
  trace groups into the same turns through `turnsOf` as it does today.
- **Span type and name.** A chat span is `chat` / `chat {model}`, a tool span is
  `execute_tool` / `execute_tool {tool}`, and a `user` span keeps `user reply` as its name.

## Open question, deliberately left open

**Whether a plainly-answered first turn seeds a session.** Today the trajectory pane
appears only once a tool has been called, so a conversation that opens with a plain answer
cannot be continued from the playground, though the server supports it. This design does
not settle it: it is a product decision about whether every ordinary playground run grows
a trajectory pane. It is recorded here because the answer changes nothing structural — a
plain first turn is a turn like any other under this model — and can be taken at any time.
