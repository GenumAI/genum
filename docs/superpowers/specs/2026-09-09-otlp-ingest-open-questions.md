# OTLP trace ingest — open questions

**Status:** not designed. This is a parking document, not a spec.
**Date:** 2026-09-09
**Depends on:** [agentic session model](2026-09-09-agentic-session-model-design.md)

The session model was designed so that ingest becomes a field mapping. Ingest itself was
deliberately split off: it is larger than the model change, it rests entirely on it, and
several of its decisions are product decisions nobody has taken yet.

Nothing here is decided. When this becomes a spec, each question below gets an answer and
a reason, and the ones marked **blocking** must be answered before any of it is built.

## The intended shape

A customer keeps their prompt — with its tool schemas, since Genum has no separate tool
entity and they live in `languageModelConfig.tools` — in Genum. Their own agent pulls it,
runs wherever they run it, and sends the resulting traces back over OTLP. Genum displays
them, lets the author pin a session as a testcase, and replays that testcase against later
versions of the prompt.

Replay never executes a tool, so what the recording must supply is each tool call's name,
arguments and result. What the prompt must supply is the tool schemas the model is offered.

## Decided

These were the blocking questions. They were researched against how Langfuse and LangSmith
solve the same problems, and answered on 2026-09-09.

**Authentication, org and project: one endpoint, a project API key.** A single
`POST /api/public/otel/v1/traces`, authenticated by `ProjectApiKey` — whose `publicKey` /
`key` pair is already the Basic Auth shape Langfuse uses — with the project, and through it
the organisation, derived from the key. Never from a header or a path segment the caller
supplies: those are strings, and the key is the thing that was authenticated.

**The prompt comes from a span attribute, with a default on the key.** `genum.prompt.id`
on the chat span, mirroring how Langfuse links a prompt (`langfuse.observation.prompt.*`,
set on the generation span rather than the trace root). An API key may also name a default
prompt, which covers the single-prompt customer with two lines of exporter config and no
attributes at all.

A prompt id in the URL path was considered and rejected: `OTEL_EXPORTER_OTLP_ENDPOINT` is
configured once per application, so a per-prompt URL forces one exporter per prompt and
cannot be produced by an off-the-shelf collector or by any framework integration that
targets a single endpoint.

**Duplicate delivery: deterministic span ids, deduplicated on `(trace_id, span_id)`.**
OTLP is at-least-once — an exporter retries a timeout whose first attempt may have
succeeded — so backend deduplication is mandatory, not optional. Genum's own writers stop
using `randomUUID()` and derive a span id from trace, turn and step index, so a retried
write lands on the row it already wrote. The table becomes `ReplacingMergeTree` keyed to
make that identity real.

This also closes the continuation-retry defect parked in the multi-turn work, where a
retried continuation could double-write spans: it was deferred for wanting "a server-side
dedupe key", which ingest requires regardless. One mechanism, both problems.

**A trace whose tools do not match the prompt is stored, not refused.** A trace is
diagnostic data, and refusing it removes observability exactly when something has drifted.
It stays pinnable, and the mismatch surfaces at run time through the existing
`missing_recording` stop, which is what that stop is for.

**Ingested usage is displayed, never summed into Genum's aggregates.** Ingested spans carry
tokens and costs computed by someone else's instrumentation. Genum's cost and token SUMs
are computed from its own provider calls and underlie billing; mixing in numbers we did not
produce makes billing unverifiable. Ingested usage gets its own accounting.

**Operations Genum does not model are stored as an inert step kind.** `embeddings`,
`retrieval`, `invoke_agent` and anything else the conventions carry are displayed and
excluded from replay — never silently dropped, because a displayed trajectory that
disagrees with what actually ran is the defect class this work keeps catching.

**Prompt version is not linked.** Langfuse links a prompt version alongside its name;
Genum has no equivalent need today, because a prompt has one live version — the latest
commit — and an ingested trace always replays against it. That is the behaviour a
regression test wants: a trace recorded before a prompt change, replayed against the
change. Revisit if pinning a testcase to a historical version ever becomes a feature.

## Blocking questions

**Do ingested traces count against a quota, and in what unit?** `ProjectApiKey` is already
tied to quota management (`services/access/AccessService.ts`). Ingest is a stream the
customer controls entirely, writing into our ClickHouse. Whether it is metered, and whether
in spans, traces or bytes, is a product and pricing decision.

## Structural questions

**Synthesising the `user` step.** The conventions put the human reply in
`gen_ai.input.messages` on the chat span, not in a span of its own. Deriving our `user`
step means diffing a turn's input messages against the previous turn's to find what is
new. Cheap when the sender includes full history on every turn; ambiguous when it does
not, or when the history was summarised or truncated between turns.

**Nested spans.** The session model assumes one loop and a flat step list. A conforming
sender may still emit a tree — a sub-agent, a chain, a retriever. Storing depth is a
schema question (`parent_span_id` exists and is always null today); displaying and
replaying it is a much larger one.

**Span id format.** OTEL ids are 16 hex characters for a span and 32 for a trace; ours are
`randomUUID()` today and become derived from trace, turn and step index under the
deduplication decision. Whether that derivation should also adopt the OTEL widths — so that
every id in the table has one shape, ingested or not — is open. The column is a `String`
and accepts both, but any code that assumes a format, or joins an ingested id to a
generated one, depends on the answer.

**Ordering an ingested session.** `turn_index` is derived by us, so ingest must decide the
order of a session's traces at the moment it writes them. Traces of one conversation can
arrive out of order, late, or interleaved with a live turn. Whether the ordinal is assigned
on arrival, recomputed per session on each write, or derived from timestamps with a
documented tie-break, is undecided.

**Late and partial delivery.** Deduplication is decided above, but arrival timing is not:
a session's traces can be delivered across several batches minutes apart, so a session read
today may be missing turns that arrive later. Whether a session is ever "complete", and
whether a testcase pinned from a half-delivered session is a problem or simply what the
author saw, is unresolved.

## Non-questions

These are settled by the session model and need no further decision:

- One trace is one turn; `session_id` groups them; `span_index` restarts per turn.
- A trace with no `gen_ai.conversation.id` is a session of one trace. The conventions
  forbid inventing one, and the read path already handles it.
- `span_type` and span names carry the conventions' operation names, so a conforming span
  needs no interpretation to be stored.
