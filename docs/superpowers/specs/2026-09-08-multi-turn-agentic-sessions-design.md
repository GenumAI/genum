# Multi-turn agentic sessions

Date: 2026-09-08
Status: approved, ready for an implementation plan
Follows: [2026-09-07 trajectory testcase screens](./2026-09-07-trajectory-testcase-screens-design.md)

## The problem

The trajectory feature models a single question. The playground runs one user
message, the model calls tools until it answers, and the trajectory ends there.
`replayTrajectory` returns at the first `final` step (`replay.ts:67-70`), and a
testcase pins one question and one chain.

That is not what an agent does. A session is a conversation: the user asks, the
agent calls tools and answers, the user asks again. Testing only the first turn
tests the turn where the agent has no history to get wrong.

Three defects found by using the shipped UI:

1. **No way to continue.** After the final answer the tool-result box disappears
   and nothing replaces it — no second turn, and no sign whether the session
   ended or broke.
2. **The playground cannot create a trajectory testcase.** "Add testcase"
   (`useTestcaseActions.ts:60-70`) sends `input`, `expectedOutput`, `lastOutput`,
   `placeholders` and `files` — no `expectedSteps`. A run with tool calls, saved
   by the obvious gesture, silently becomes a plain text testcase.
3. **The trajectory renders badly and does not scale.** In `StepRow` neither the
   tool name nor the final answer carries a size class, so both inherit the base
   size while everything around them is `text-sm`/`text-xs` — the final answer is
   the largest text on screen. Arguments render as a four-line block; at five
   tool calls the panel is a wall.

## Decisions

**1. A session is a flat step list with a new `user` step kind.**

`StepSchema` gains a third member:

```ts
{ kind: "user", text: string, enabled?: boolean }
```

A session is `[tool_call, tool_call, final, user, tool_call, final, …]`. Turn
boundaries are derived: a turn begins at each `user` step. The first turn's
question is not a step — it stays `testcase.input` (decision 4).

**Nested turns** (`steps` becomes a list of turn objects) expresses the structure
honestly but breaks the column's shape, `compareSteps`, every index-based helper
(`withStepPatch`, `enabledCount`) and `StepMismatch.index` — code that passed
nine task reviews and a whole-branch review. **A separate column for replies**
avoids touching `Step` but creates two structures that must agree on ordering;
two sources of truth for one fact is the class that produced a false green
verdict twice on the previous branch. The flat list keeps every index-addressed
mechanism working; turn structure is derived deterministically in one pass.

**2. Unticking a user reply truncates the session there.**

`enabled === false` means something different on a `user` step than on a
`tool_call`: on a tool call, "do not compare this"; on a reply, "the session ends
here". A conversation cannot have a hole — skipping a reply would replay turn 3
into a context that never contained turn 2.

Because one control carries two meanings, the user row states its meaning in
words ("ends the session here"). It does not rely on the reader inferring it. A
label that asserts what the adjacent code does not do is the defect class the
previous branch hit three times.

Truncation is applied **once, at the boundary**, producing the *effective* step
list. Replay, comparison, the step budget and the "asserts something" predicate
all consume that list, so none of them can disagree about where the session ends.

**3. Comparison runs per turn.**

Replies cut the effective list into turns. Matching and `orderMatters` apply
**within** a turn. Mismatch indices stay indices into the flat array, so
`lastMismatches`, the panel's per-step marks and every index-addressed consumer
are unaffected.

Flat comparison was rejected because it hides the failure this feature exists to
detect. Pin two turns: turn 1 calls `get_weather(Paris)`, turn 2 calls
`get_weather(London)`. An agent that swaps them answers the wrong city in both.
With `orderMatters: false` and flat matching, expected `{Paris, London}` matches
actual `{London, Paris}` and the testcase passes green. Per-turn matching fails
turn 1.

`orderMatters` stays **one boolean per testcase**, now meaning "within a turn".
Its label must say so; a control whose meaning silently narrowed is a lie in the
UI. A per-turn flag was rejected as unearned complexity.

**4. `input` stays the first question; later replies are steps.**

`testcase.input` holds the opening message with its own editor. Later replies
live in the trajectory.

This is asymmetric, and mirroring the first reply into both `input` and a leading
`user` step was rejected: the branch already carries one such mirror
(`expectedOutput` and the final step), it cost a dedicated task plus a two-writer
race, and a second would double that surface for a cosmetic gain.

Placeholders are not part of this asymmetry. `renderPlaceholders` substitutes
into the prompt's *instruction* (`run.ts:172`); the question is passed to the
provider raw (`run.ts:210`). First question and later replies are both plain
text. A testcase pins **one** set of placeholder values for the whole session,
and every turn renders the instruction with it; per-turn values would mean
different instructions inside one conversation, which the product does not have.

**5. Divergence stops the whole session.**

When replay diverges — a tool the recording does not cover, or the step budget
exhausted — the session stops and later turns are not attempted. Feeding turn 3's
question into a conversation that never contained turn 2's real exchange tests
nothing. `status = NOK`, and `lastMismatches` holds whatever the comparison
produced up to that point.

`ReplayStop` carries the turn index it stopped in, not only the step. Spec 2's
decision 1 exists to stop verdict information living only in prose, and "which
turn" is verdict information.

**6. Every turn's final answer is editable in the panel.**

A multi-turn session has one final answer per turn, and each is compared. Each is
therefore editable in its own row.

The separate expected-output editor shows the **last** turn's answer and stays
synchronised with it: `expectedOutput` mirrors the last enabled `final`. Spec 2's
decision 3 — the expected-output editor *is* the final step, one notion of "the
expected answer" instead of two — is preserved and extended rather than
abandoned. Its failure mode, had intermediate finals stayed uneditable, was
exactly what that decision was written to prevent: an expected answer the author
can see and cannot change.

**7. Truncation rewrites `expectedOutput`, and the server does the cascade.**

Truncating changes which final is last, so `expectedOutput` must follow or it
describes a turn the session no longer reaches — breaking spec 2's requirement
that the text testcase underneath be correct the moment the trajectory is
removed.

The client sends only `expectedSteps`; the server recomputes the last enabled
final and writes `expectedOutput` in the same update. This is the mechanism
already used when clearing a trajectory cascades `stepsConfig` and
`lastMismatches` (spec 2 decision 4). Doing it server-side means no second client
writer appears, which matters because the panel saves per action with no Save
button and this branch already produced one two-writer race.

**8. A user continuation is a new run; a tool continuation is not.**

`LogType.PromptRunTurn = "prt"` and `RUN_COUNT = countIf(log_type != 'prt')`
exist so that turns the model spends fetching tools inside **one question** are
not counted as separate runs. A user reply is a new question by a human, so it
logs as a run.

Without this the server cannot tell the two apart — it keys only on `traceId`
being present (`prompt.controller.ts:149`) — and a ten-question conversation
would count as one run with its success rate over a denominator of one. Cost and
token sums are unaffected either way: they cover every row regardless of type.

**9. A trace exists once the session continues, not once a tool is called.**

Spec 1 minted a trace only when the first turn returned tool calls
(`prompt.controller.ts:139-146`), so "turn 1 answers plainly, turn 2 asks the
real question and calls tools" could not be recorded at all.

This reopens that decision deliberately. **Not** calling a tool is an answer to
the question spec 1 sold — "in this context, did the prompt pick the right
tool?" — and an agent that calls a search tool on "hello" is as broken as one
that fails to call it when needed. A two-turn session with no tool calls is a
testable thing. The "continue" input therefore appears after any answer.

**10. The user's turn is recorded as a new span type.**

`trace_spans` gains a third `span_type` carrying the reply's text.
`span_type` is `LowCardinality(String)`, so no DDL is required; `toSpanRows`,
`SpanRow`, its web mirror and `spansToSteps` all change.

Without it the Logs tab — the surface that exists to turn production history into
tests — cannot rebuild a multi-turn session: `spansToSteps` currently maps every
non-tool span to a `final`, and the root `logs` row records the **first** question
on every turn, so a later reply is durably recorded nowhere.

The playground does not depend on this. It already holds the whole trajectory in
memory (`usePlaygroundPromptRun.ts`), so its picker reads that rather than making
a round trip through ClickHouse.

**11. The playground's "Add testcase" opens the step picker.**

The same picker the Logs tab uses, fed from the in-memory trajectory. A run with
no tool calls and one turn keeps today's behaviour and creates a plain text
testcase without showing a picker.

**12. The trajectory view is grouped, collapsed and consistently sized.**

- Steps group by turn, with a turn header; a turn collapses whole.
- A tool call renders as one line — `get_weather · city: Paris, country: France`
  — with a disclosure control. Expanded, it shows the full argument JSON and the
  recorded result.
- Each final answer is labelled with its turn and is editable.
- Everything is `text-sm`; argument JSON is monospaced `text-xs`. This fixes the
  oversized final answer.
- A finished turn shows a "continue" input rather than nothing, so the end of a
  cycle is visible instead of implied by an absence.

## Data flow

Recording:

```
input ──▶ run ──▶ toolCalls? ──▶ author types each result ──▶ run
                       │                                       │
                       └── final answer ──▶ "continue" input ───┘
```

Every continuation posts to `/prompts/:id/run` with the accumulated `messages`
and the same `traceId`. A tool continuation adds `{ role: "tool", … }`; a user
continuation adds `{ role: "user", content }`.

`ConversationMessage` does not have a `user` role today — it is
`assistant | tool` (`providers/index.ts:38-40`), mirrored `.strict()` in
`prompt.type.ts:84-100` with a compile-time drift assertion. The union, the Zod
mirror and the four provider mappers each grow a case. This is wire-format work
the first version of this spec wrongly implied was already done.

Replay walks the effective list:

```
tool_call ──▶ feed recordedResult, never execute
final     ──▶ next step is `user`? feed it and continue : session ends
```

Replay emits the `user` steps it fed into `lastSteps`, so the actual trajectory
has the same turn structure as the expected one and the panel can group both.

## API

`StepSchema` gains `UserStepSchema`, with non-empty `text`.

`hasEnabledStep` is the single shared definition of "this trajectory asserts
something", used by the write boundary (`EnabledStepsSchema`) and the read
boundary (`readExpectedSteps`). It changes in two ways at once, and both are
required:

- it runs on the **effective** list, after truncation;
- it counts only steps that can be compared — `tool_call` and `final`.

Either alone is wrong. Counting the raw list lets a session truncated at turn 1,
whose only enabled steps live in dead turns, pass the boundary and assert
nothing. Counting replies lets a session of nothing but replies do the same. The
read side makes this worse than a validation miss: `readExpectedSteps` returning
`null` does not error, it silently reclassifies the testcase as a text one and
asserts `expectedOutput` instead.

`maxStepsForRecording` becomes `toolCalls + turns` over the effective list, not
`toolCalls + 1`. The `+ 1` was the single final answer; a T-turn session needs T.
Left alone, a five-turn session with eight tool calls gets a budget of 9 where it
needs 13 and fails `step_limit` on every run — the exact failure that function
was written to remove.

`spanIndexOffset` (`turn.ts:36-39`) currently sums tool calls only. Once a
mid-trace turn writes `final` and `user` spans, it must count every written span
or the append-only ordering collides.

The recorded-result lookup (`replay.ts:87`) addresses mocks by a global ordinal
per tool name. It becomes per-turn, following the comparison: a tool called in
turns 1 and 3 must take turn 3's recording for turn 3.

No new PostgreSQL columns. `expectedSteps`, `stepsConfig`, `lastSteps`,
`lastMismatches` and `lastRunAt` keep their shapes.

## Error handling

- A `user` step with empty text is rejected at the boundary; a blank turn sends an
  empty message to the provider and compares nothing.
- Truncation that leaves nothing comparable is rejected exactly as an
  all-unticked trajectory already is, and the panel offers trajectory removal at
  that moment rather than sending a request that will 400. The web's
  `enabledCount` must mirror the server predicate's new shape, or the panel
  offers removal at the wrong moment — the case spec 2's error handling exists to
  prevent.
- Steps after the cut are stored but dead. They render with a third outcome,
  "not reached", distinct from "not checked": a step that was excluded from the
  assertion and a step the session never got to are different facts.
- A recording whose last step is a `user` reply — the author stopped on a
  question — replays that turn and ends with whatever the model answers. Not an
  error.
- The AI assertion arm is given the turn boundaries. It currently receives
  `JSON.stringify(expectedSteps)` and the actual steps as flat blobs
  (`testcase.controller.ts:293-297`); a judge that cannot see turns cannot catch
  the swapped-city failure that decision 3 is built around.

## Testing

- Replay: a two-turn session replays both; a truncated session replays only to
  the cut; divergence in turn 1 does not attempt turn 2; `lastSteps` carries the
  replies.
- Comparison: the swapped-city case fails per-turn. **This test must be written so
  that it passes against a flat implementation** — otherwise it does not pin
  decision 3 at all.
- Budget: a five-turn recording gets a budget that its own replay does not exceed.
- Boundary: a session of only replies is rejected; a session truncated so that
  every comparable step is dead is rejected.
- Cascade: truncation rewrites `expectedOutput` to the new last final, server-side.
- Analytics: a user continuation increments the run count, a tool continuation
  does not, and cost sums cover both.
- Web: `spansToSteps` rebuilds a multi-turn trace including replies; the
  turn-grouping helper is pure and tested. Components are not tested — `apps/web`
  has no component harness and this spec does not add one.

## Non-goals

- Editing a user reply's text after creation. The reply is what was asked;
  changing it makes a different conversation, which is a new pin.
- Branching a session, or re-running one turn in isolation.
- Per-turn `orderMatters`.
- Streaming a replay's turns to the UI. Replay is server-side and returns once.
- Nested turn storage, unless the flat list demonstrably fails.

## Known limits

- `MAX_CONVERSATION_MESSAGES = 100` (`prompt.type.ts:73`) was sized for one
  question's tool loop and is now a session-length cap. Left as is, deliberately:
  every turn resends the whole conversation and is separately billed, so a cap is
  wanted; 100 is simply no longer derived from anything.
- "Run" already means two things — the playground path writes a root row per turn,
  the testcase path writes one summed row and no `prt` rows at all
  (`testcase.controller.ts:394-432`). Decision 8 does not close that gap; it
  avoids widening it.
