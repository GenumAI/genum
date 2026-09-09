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

## Blocking questions

**How does a sender authenticate, and what identifies the org, project and prompt?**
Genum's routes carry the org and project in `lab-org-id` / `lab-proj-id` headers behind
JWT or cookie auth; a collector sends OTLP, usually with a bearer token and no notion of
either. The three ids are required columns on every span row. Whether this is an API key
per project, a resource attribute the sender sets, or both, is undecided.

**Which prompt does an ingested trace belong to?** `prompt_id` is a required column and
the replay needs the prompt's tool schemas. Nothing in the conventions names a prompt. The
candidates are a resource or span attribute the customer sets, a lookup by the system
prompt's content hash, or refusing traces that do not declare one.

**What happens to a trace whose tools do not match the prompt's?** A recording naming a
tool the prompt does not offer cannot be replayed — the model will never call it. Whether
that trace is refused at ingest, stored but unpinnable, or stored and allowed to fail at
run time, is undecided. It is the ingest equivalent of the `missing_recording` stop.

**Is ingested data trusted for billing and analytics?** Ingested spans carry real
`gen_ai.usage.*` tokens and real costs, computed by someone else's instrumentation. Genum's
cost and token SUMs are today computed from its own provider calls on `logs` rows. Whether
ingested usage enters those aggregates, sits in a separate accounting, or is displayed
without being summed, is a product and a billing decision, not a technical one.

## Structural questions

**Synthesising the `user` step.** The conventions put the human reply in
`gen_ai.input.messages` on the chat span, not in a span of its own. Deriving our `user`
step means diffing a turn's input messages against the previous turn's to find what is
new. Cheap when the sender includes full history on every turn; ambiguous when it does
not, or when the history was summarised or truncated between turns.

**Operations we do not model.** `embeddings`, `retrieval`, `invoke_agent` and anything
else the conventions carry have no step kind in Genum, whose model is deliberately one
loop: chat, tools, replies. Whether such spans are dropped, stored as an inert kind that
displays but never replays, or refuse the whole trace, is undecided. Dropping them
silently would make a displayed trajectory disagree with what actually ran.

**Nested spans.** The session model assumes one loop and a flat step list. A conforming
sender may still emit a tree — a sub-agent, a chain, a retriever. Storing depth is a
schema question (`parent_span_id` exists and is always null today); displaying and
replaying it is a much larger one.

**Span id format.** Ours are `randomUUID()`; OTEL ids are 16 hex characters for a span and
32 for a trace. The column is a `String` and accepts both, but any code that assumes one
format — or any join between an ingested id and a generated one — needs to know.

**Ordering an ingested session.** `turn_index` is derived by us, so ingest must decide the
order of a session's traces at the moment it writes them. Traces of one conversation can
arrive out of order, late, or interleaved with a live turn. Whether the ordinal is assigned
on arrival, recomputed per session on each write, or derived from timestamps with a
documented tie-break, is undecided.

**Partial and repeated delivery.** OTLP senders retry, and a collector may deliver the
same span twice or a session's traces across several batches minutes apart. `trace_spans`
is append-only and has no unique key, so a duplicate delivery is a duplicated step unless
ingest deduplicates on `(trace_id, span_id)`. This is the same class of problem as the
continuation retry already parked in the multi-turn work.

## Non-questions

These are settled by the session model and need no further decision:

- One trace is one turn; `session_id` groups them; `span_index` restarts per turn.
- A trace with no `gen_ai.conversation.id` is a session of one trace. The conventions
  forbid inventing one, and the read path already handles it.
- `span_type` and span names carry the conventions' operation names, so a conforming span
  needs no interpretation to be stored.
