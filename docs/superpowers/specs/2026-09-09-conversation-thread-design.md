# One conversation thread, replacing three renderings of it

**Status:** proposed, awaiting review
**Supersedes nothing.** Builds on `2026-09-09-agentic-session-model-design.md` (the session/turn/step model) and reuses its vocabulary unchanged.

## The problem

The playground renders the same conversation up to three times, in three components written at
different times, none of which knows about the others.

| Component | Where | Shows | Can edit | Verdicts |
|---|---|---|---|---|
| `TrajectorySteps` | live run | cards, inherited (large) text, reply box | no | no |
| `TrajectoryPanel` → `StepRow` | saved testcase with a trajectory | turns, `text-sm`, checkboxes, order toggle | yes, per `final`, on blur | yes, per step |
| `OutputBlock` | always | `Last Output` / `Expected Output`, 320px Monaco diff, metrics | yes, one value | no |

For a saved testcase with a trajectory all three are on screen at once, and the model's answer
appears in all three. The always-mounted diff editor is the loudest element on the page and
carries the least: `Expected Output` holds no state of its own.

That last point is the important one. Decision 7 of the session-model spec makes
`expectedOutput` a **mirror** of the last enabled `final` in `expectedSteps`; the server
maintains it on create and on update (`testcase.controller.ts:101` and `:163`). The big
`Expected Output` pane is therefore one element of `expectedSteps`, shown a second time in a
second widget, with no way to reach any of the others.

## What already exists

The redesign is mostly consolidation, not new capability. Before building anything, know that
these are already written and working:

- `StepRow` renders a `final` with **editable text**, buffered locally and committed on blur,
  and renders an outcome badge (`matched` / `mismatched` / `not-asserted` / `not-reached`).
- `TurnSection` groups steps into turns with a live/total step count.
- `turnsOf`, `effectiveSteps`, `lastEnabledFinal` (`apps/web/src/lib/session.ts`, mirrored from
  core) already define where turns begin and which `final` the top-level expected mirrors.
- `useTestcaseTrajectory.setStepText` already persists one step's text and returns whether the
  write landed, so a buffered textarea can keep a rejected draft.
- The server already cascades `expectedOutput` from `expectedSteps`.

**The backend needs no change for this work.**

## Decisions

**D1. One component, `ConversationThread`, replaces all three renderings.** The live playground
run, the saved testcase's trajectory, and the output block become one thread. Approved scope:
all three at once, not staged.

**D2. The per-character diff moves behind a per-message fullscreen control.** The thread shows
the produced text, the expected text and a verdict; the `⛶` on a message opens the existing
expanded dialog with that turn's produced text against that turn's expected text. Nothing
mounts Monaco in the default view. (Monaco stays in the bundle for the prompt editor, so this
is a layout and attention win, not a bundle win.)

**D3. The reply is a button, not a standing field.** `+ Add message` sits at the end of the
thread and expands into the reply field on click. It appears under exactly today's condition
(`canReply`): nothing in flight, no tool awaiting a result, last step is a `final`.

**D4. Produced and expected are paired by turn ordinal — the same rule the verdict uses.**
`compareSteps` pairs `expectedTurns[i]` with `actualTurns[i]` (`compare.ts:151-154`) and, inside
a turn, by order or unordered per `stepsConfig`. The thread MUST pair the same way. A thread
that pairs differently from the comparison shows an author text that contradicts the badge
sitting next to it, and there is no way for them to tell which is lying.

**D5. Metrics appear on a message only where they were measured.** The live playground has a
response per turn, so per-message tokens/cost/time are real there. A recorded or replayed
trajectory has none: `trace_spans` writes `tokens_in`, `tokens_out`, `cost` and `duration_ms`
as **zeros by design** — placeholders keeping the OTel-shaped schema intact, not measurements
(`spans.ts:117-121`). Rendering those would state that a turn cost nothing. A saved testcase
therefore shows aggregate metrics on the thread header and none per message.

**D6. A plain text testcase stays a plain text testcase.** This is the trap in the whole
redesign and it is worth stating twice. A testcase with `expectedSteps = null` — the great
majority of existing ones — is compared through `expectedOutput` and the assertion; a testcase
with an `expectedSteps` array is compared through `compareSteps` (`testcase.controller.ts:235`).
The thread renders a text testcase as a **thread of one message**, and "save as expected" there
writes `expectedOutput` **directly**. It must NOT synthesize a one-element `expectedSteps`
array: that silently converts the testcase to trajectory comparison and changes its verdict
with no author action. Only the step picker and a recorded run may create `expectedSteps`.

**D7. Without a testcase, expected text is a local draft.** Exactly as `modifiedValue` behaves
today: edits live in memory, and `Add testcase` materializes the whole thread at once. Nothing
is written per-keystroke to a testcase that does not exist.

**D8. The assertion selector stays in the thread header.** Strict / AI / Manual is a property of
the testcase, not of a message. It does not move into the thread body.

## The component model

```
ConversationThread
├─ header      assertion selector, aggregate metrics, expand-all
├─ TurnSection (per turn, from turnsOf)
│  └─ ThreadMessage (per step)
│     ├─ user       the author's reply
│     ├─ tool_call  name, args, recorded result   (unchanged from StepRow)
│     └─ final      produced text
│                   metrics          (D5: live runs only)
│                   verdict badge    (when a comparison was recorded)
│                   expected text    (editable; collapsed when equal to produced)
│                   [Save as expected]  [⛶ compare]
└─ + Add message   (D3)
```

`ThreadMessage` is `StepRow` grown up, not a new component: it keeps the editable-`final`
behaviour, the outcome badge and the enabled checkbox, and gains produced text, metrics and the
two buttons.

The thread's input is one normalized array so that the two sources cannot drift:

```ts
interface ThreadMessage {
    step: Step;            // the expectation (or, live, what happened)
    index: number;         // flat index -- what mismatches and every save address
    produced?: string;     // last run's text for this turn's final, paired per D4
    metrics?: RunMetrics;  // D5: present only when measured
    outcome?: "matched" | "mismatched" | "not-asserted" | "not-reached";
}
```

Two adapters build it — one from the live `trajectory` state, one from the testcase's
`expectedSteps` / `lastSteps` / `lastMismatches`. The adapters are where the source-specific
knowledge lives; the thread itself knows only `ThreadMessage[]`.

## What is deleted

- `TrajectorySteps.tsx` (replaced)
- `TrajectoryPanel.tsx` (replaced; its checkbox, order toggle and empty-trajectory confirmation
  move into the thread — `wouldEmptyTrajectory` and its dialog are behaviour, not decoration,
  and must survive)
- the two-column `MetricsDisplay` grid and the always-mounted `CompareDiffEditor` in `Output.tsx`
- `useExpectedOutput`'s single `modifiedValue` model, replaced by per-message drafts

Kept, adapted: `ExpandedOutputDialog` (generalized from "the last answer" to "this turn"),
`OutputActions`' `Add testcase`, `OutputHeader`'s assertion panel, `useTestcaseActions`,
`TestcaseStepPickerDialog`.

**Behaviours that must survive the deletion**, each of which exists because something broke
without it: expected clears when the prompt changes and no testcase is selected; expected and
output clear when a testcase is deselected; a rejected `setStepText` keeps the author's draft
and leaves the field dirty so a later resync cannot overwrite it; the trajectory sits above,
never in place of, the add-testcase affordances.

## Error handling

Unchanged in kind. A failed per-message save toasts and returns `false`, and the message keeps
its draft (existing `setStepText` contract). A failed continuation shows the turn-failed row
with `Retry`, as today. A thread with no messages renders nothing at all rather than an empty
frame.

## Testing

- `ThreadMessage` adapters: a live run and a saved testcase with the same conversation produce
  the same `ThreadMessage[]` shape.
- D4: a two-turn testcase whose second turn produced different text pairs turn 2's produced with
  turn 2's expected — a test that fails against pairing by flat index.
- D5: a message built from recorded spans carries no metrics, and specifically does not render
  zeros.
- D6: saving expected on a text testcase sends `expectedOutput` and does **not** send
  `expectedSteps` — the test that fails against the tempting one-element-array implementation.
- D3: the reply control is absent while a tool is pending, while a turn is in flight, and when
  the last step is not a `final`.
- Existing `session.test.ts`, `spansToSteps.test.ts` and `trajectoryEdits.test.ts` keep passing
  untouched; this work adds no new rule to any of them.

## Out of scope

- Any backend change. The cascade, the comparison and the replay are untouched.
- Renaming the stored `"final"` discriminator (persisted in every testcase's JSON; copy only).
- Per-turn metrics for recorded trajectories. Making those real means carrying `logs` rows per
  turn into the testcase, which is its own piece of work; until then D5 holds.
- The OTLP ingest work, still parked in `2026-09-09-otlp-ingest-open-questions.md`.
