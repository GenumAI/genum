# Multi-turn agentic sessions

Date: 2026-09-08
Status: approved, ready for an implementation plan
Follows: [2026-09-07 trajectory testcase screens](./2026-09-07-trajectory-testcase-screens-design.md)

## The problem

The trajectory feature models a single question. The playground runs one user
message, the model calls tools until it answers, and the trajectory ends there.
`replayTrajectory` returns at the first `final` step (`replay.ts:67-70`), and a
testcase pins exactly one question and one chain.

That is not what an agent does. A real session is a conversation: the user asks,
the agent calls tools and answers, the user asks again, the agent calls more
tools. Testing only the first turn tests the least interesting part — the turn
where the agent has no history to get wrong.

Three concrete defects, found by using the shipped UI:

1. **No way to continue.** After the model's final answer the tool-result box
   disappears and nothing replaces it. There is no input for a second turn, and
   nothing says the session ended rather than broke.
2. **The playground cannot create a trajectory testcase.** "Add testcase"
   (`useTestcaseActions.ts:60-70`) sends `input`, `expectedOutput`, `lastOutput`,
   `placeholders` and `files` — no `expectedSteps`. A run with tool calls,
   saved by the obvious gesture, silently becomes a plain text testcase. Only
   the Logs tab's picker can pin a trajectory.
3. **The trajectory renders badly and does not scale.** In `StepRow` neither the
   tool name nor the final answer's text carries a size class, so both inherit
   the base size while everything around them is `text-sm`/`text-xs` — the final
   answer is the largest text on the screen. Arguments render as a four-line
   pretty-printed block. At one tool call this is untidy; at five it is a wall.

## Decisions

**1. A session is a flat step list with a new `user` step kind.**

`StepSchema` gains a third member:

```ts
{ kind: "user", text: string, enabled?: boolean }
```

A session is `[tool_call, tool_call, final, user, tool_call, final, …]`. Turn
boundaries are derived: a new turn begins at each `user` step. The first turn's
question is not a step — it stays `testcase.input` (decision 4).

Two alternatives were rejected. **Nested turns** (`steps` becomes a list of turn
objects) expresses the structure honestly but breaks the column's shape,
`compareSteps`, every index-based edit helper (`withStepPatch`, `enabledCount`),
and `StepMismatch.index` — code that just passed nine task reviews and a
whole-branch review. **A separate column for user replies** avoids touching
`Step`, but creates two structures that must agree on ordering; two sources of
truth for one fact is the defect class this branch already produced twice, both
times as a false green verdict.

The flat list keeps every index-addressed mechanism working unchanged. The turn
structure is derived rather than stored, which is acceptable because it is
derived deterministically in one pass.

**2. Unticking a user reply truncates the session there.**

`enabled === false` means something different on a `user` step than on a
`tool_call`: on a tool call it means "do not compare this"; on a user reply it
means "the session ends here". A conversation cannot have a hole in the middle —
skipping a reply and continuing would replay turn 3 into a context that never
contained turn 2.

Because one control carries two meanings, the UI must say which one is in play.
The user row states it in words ("ends the session here"); it does not rely on
the reader inferring it from the checkbox. A comment or a label that asserts what
the adjacent code does not do is the exact defect class the previous branch hit
three times.

Truncation is applied **once, at the boundary**, producing the effective step
list. Replay and comparison both consume that list, so they cannot disagree about
where the session ends.

**3. Comparison runs per turn.**

User replies cut the effective list into turns. Matching, and the `orderMatters`
rule, apply **within** a turn. Mismatch indices remain indices into the flat
array, so `lastMismatches`, the panel's per-step marks, and every existing
index-addressed consumer are unaffected.

Flat comparison across the whole session was rejected because it hides the
failure this feature exists to detect. Pin a two-turn session — turn 1 calls
`get_weather(Paris)`, turn 2 calls `get_weather(London)`. A regressed agent that
swaps them answers the wrong city in both turns. With `orderMatters: false` and
flat matching, expected `{Paris, London}` matches actual `{London, Paris}`
exactly and the testcase passes green. Per-turn matching fails turn 1 on the
spot.

`orderMatters` keeps its current meaning inside a turn: an agent that calls three
tools in a different order within one turn is not necessarily wrong.

**4. `input` stays the first question; later replies are steps.**

`testcase.input` continues to hold the opening message, with its own editor and
its placeholder substitution. Subsequent replies live in the trajectory.

This is asymmetric — the first reply lives somewhere the others do not — and the
alternative was to mirror the first reply into both `input` and a leading `user`
step. That was rejected: the branch already carries one such mirror
(`expectedOutput` and the final step), it cost a dedicated task plus a two-writer
race, and a second one would double that surface for a cosmetic gain.

**5. Divergence stops the whole session.**

When replay diverges — the model calls a tool the recording does not cover, or
the step budget runs out — the session stops there, and later turns are not
attempted. Feeding turn 3's question into a conversation that never contained
turn 2's real exchange tests nothing. `status = NOK`, and `lastMismatches` is
whatever the comparison up to that point produced.

**6. `expectedOutput` mirrors the last enabled `final` step.**

A multi-turn session has one final answer per turn. The session's answer is the
last one. The expected-output editor edits that step, and writes `expectedOutput`
with the same text — the rule the previous spec established, applied to the step
that is now ambiguous without it.

**7. The playground's "Add testcase" opens the step picker.**

The same picker the Logs tab uses. The run already has a `traceId` and its spans
are already written, so this is wiring existing parts: `spansToSteps` and
`TestcaseStepPickerDialog` both ship. A run with no tool calls keeps today's
behaviour and creates a plain text testcase without showing a picker.

**8. The trajectory view is grouped, collapsed and consistently sized.**

- Steps are grouped by turn, with a turn header, and a turn can be collapsed
  whole.
- A tool call renders as one line — `get_weather · city: Paris, country: France`
  — with a disclosure control. Expanded, it shows the full argument JSON and the
  recorded result.
- The final answer is labelled as such rather than floating as bare text.
- Everything is `text-sm`; argument JSON is monospaced `text-xs`. This is what
  fixes the oversized final answer.
- In the playground, a finished turn shows a "continue" input rather than
  nothing, so the end of a cycle is visible instead of implied by an absence.

## Data flow

Recording (playground):

```
user types input ──▶ run ──▶ toolCalls? ──▶ author types each result ──▶ run
                                  │                                       │
                                  └── final answer ──▶ "continue" input ──┘
```

Each continuation posts to the same `/prompts/:id/run` with the accumulated
`messages` and the same `traceId`, exactly as the tool-result continuation
already does. A user continuation adds a `{ role: "user", content }` message
where a tool continuation adds a `{ role: "tool", … }` one.

Replay (testcase run) walks the effective step list:

```
for each step:
  tool_call ──▶ feed recordedResult, never execute
  final     ──▶ next step is `user`? feed it and continue : session ends
  user      ──▶ (reached only via the branch above)
```

## API

`StepSchema` gains `UserStepSchema`. `EnabledStepsSchema`'s "asserts something"
predicate needs care: a session whose only enabled steps are `user` replies
asserts nothing, because user replies are never compared. `hasEnabledStep` must
therefore count only steps that can be compared — `tool_call` and `final` — or a
testcase with every tool call unticked would pass the boundary and always run
green.

No new columns. `expectedSteps`, `stepsConfig`, `lastSteps`, `lastMismatches` and
`lastRunAt` all keep their shapes.

## Error handling

- A `user` step with empty text is rejected at the boundary. A blank turn would
  send an empty message to the provider and produce a meaningless comparison.
- Truncation that leaves nothing comparable is rejected the same way an
  all-unticked trajectory already is, and the panel offers trajectory removal at
  that moment rather than sending a request that will 400.
- A recording whose last step is a `user` reply — the author stopped the session
  mid-question — replays that turn and ends with whatever the model answers. It
  is not an error.
- Divergence mid-session reports which turn it stopped in, not only which step.

## Testing

- Replay: a two-turn session replays both turns; a truncated session replays only
  up to the cut; divergence in turn 1 does not attempt turn 2.
- Comparison: the swapped-city case above fails per-turn and would pass flat —
  this is the test that pins decision 3, and it must be written so that it fails
  against a flat implementation.
- Boundary: a session whose only enabled steps are `user` replies is rejected.
- Truncation: applied once, with replay and comparison observing the same cut.
- Web: `spansToSteps` maps a multi-turn trace; the turn-grouping helper is pure
  and tested. Components are not tested — `apps/web` has no component harness and
  this spec does not add one.

## Non-goals

- Editing a user reply's text after the testcase is created. The reply is what
  was asked; changing it makes a different conversation, which is a new pin.
- Branching a session, or re-running one turn in isolation.
- Streaming a replay's turns to the UI. Replay is server-side and returns once.
- Nested turn storage (decision 1's rejected alternative), now or later, unless
  the flat list demonstrably fails.
