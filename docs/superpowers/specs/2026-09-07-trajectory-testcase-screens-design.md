# Trajectory testcase screens

Date: 2026-09-07
Status: approved, ready for an implementation plan
Follows: [2026-09-03 agentic tool testing](./2026-09-03-agentic-tool-testing-design.md)

## The problem

The trace-to-test feature ships create-and-run and nothing else. A trajectory testcase
can be built from a log and executed, and the verdict is correct — but nothing in
`apps/web` reads `expectedSteps`, `lastSteps` or `stepsConfig`. The web `TestCase` type
does not even declare them.

The consequences, in the order an author meets them:

1. Turning a log into a testcase is blind. The picker lists the steps, but the log detail
   dialog it opens from shows no trajectory, so the author picks without having seen the
   run.
2. Once created, a trajectory testcase is indistinguishable from a text one in the list.
3. Opening it shows no pinned steps. The author cannot see what the test asserts.
4. Nothing can be changed. Unticking a step or loosening an argument matcher means
   deleting the testcase and rebuilding it from the log.
5. A failure reports as a prose string in `assertionThoughts`. Which step failed, and how,
   must be read out of a sentence.
6. `orderMatters` is hard-coded `false` at the picker (`useAddTestcaseFromLog.ts`) and has
   no control anywhere.
7. `runTestcase` writes `lastSteps` on every run, commented "so the UI can diff the
   trajectory without running the prompt again". That field has no reader.

This design adds the read-and-edit half.

## Decisions

**1. Per-step pass/fail is computed on the server and persisted.**

A new `lastMismatches Json?` column holds the structured result `compareSteps` already
produces, which `runTestcase` currently collapses into `assertionThoughts` and a status
enum. The web renders what the server decided.

The alternative — comparing `expectedSteps` against `lastSteps` in the browser — was
rejected. It would put the matching algorithm in two places: maximum bipartite matching
with augmenting paths, three argument matchers, and the disabled-step skip rule. A second
implementation of the decision this feature exists to make is the defect class this branch
removed twice already (the name-keyed results map in Task 6, and mismatches re-derived
from the consumed set, found in the final review). Both produced a false "passed".

Returning mismatches in the run response without storing them was also rejected: the
verdict survives a page reload, so its explanation must too.

**2. Editing expectations does not touch the stored verdict.**

Unticking a step, changing an argument matcher, or toggling `orderMatters` writes the
expectation and leaves `status`, `assertionThoughts` and `lastMismatches` alone. The
testcase keeps reporting the last run's verdict until it is run again.

This is the author's call, made with the trade-off stated: the list will show a green
testcase whose verdict was computed under rules that no longer apply. The panel labels the
last run with its timestamp so the staleness is visible where the steps are, rather than
being silently implied.

**3. The expected-output editor *is* the final step.**

A trajectory testcase currently stores two expected answers. `runTestcase` takes the
trajectory branch whenever `expectedSteps` is present and never consults `expectedOutput`,
while the picker writes the log's output into both `expectedOutput` and the final step.
Editing the field that is shown changes nothing.

So for a testcase with a trajectory, the existing expected-output editor edits the final
step's `text`, and a checkbox beside it is that step's `enabled`. One notion of "the
expected answer" instead of two.

`expectedOutput` is written with the same text on every such save. It is not the assertion
while a trajectory exists, but it must be correct for the moment the trajectory is
removed (decision 4) — at which point the text testcase underneath is already right.

**4. A trajectory can be removed, returning a plain text testcase.**

`expectedSteps: null` in an update clears the trajectory. This is the limitation Task 7
recorded and could not fix: `trajectoryColumns` in `TestcasesRepository` skips `undefined`
and passes anything else through as `Prisma.InputJsonValue`, and a JSON `null` column needs
`Prisma.DbNull`, not `null`.

The author reaches it by unticking the last enabled step: the boundary rejects an
`expectedSteps` with nothing enabled (`EnabledStepsSchema`), so without an exit the author
is stuck. The panel offers "remove the trajectory, keep a text testcase" at that moment.

Clearing `expectedSteps` clears `stepsConfig` and `lastMismatches` in the same write. The
server cascades this, so a client that sends only `expectedSteps: null` cannot leave a row
holding a step config and a per-step explanation for a trajectory that no longer exists.
`lastSteps` is kept: it is a record of what a run did, not an assertion, and it costs
nothing to leave.

This is the one exception to decision 2. Removing a trajectory removes the thing
`lastMismatches` explains, so keeping it would be keeping an explanation of nothing.
`status` and `assertionThoughts` are still left alone.

**5. The log detail dialog shows the recorded trajectory, read-only.**

A log with `trace_id` gets a trajectory section in `LogDetailsDialog`, built from the
existing `logsKeys.traceSpans` query and the `spansToSteps` mapper, both shipped in Task 9.
No new backend. The "add testcase" button and its picker are unchanged; this only means the
author sees the chain before deciding to pin it.

**6. Edits persist per action, with no Save button.**

Toggling a checkbox or changing a matcher writes immediately, matching how the playground
already persists a testcase (`handleInputBlur` saves the input on blur, `handleSaveAsExpected`
saves on an explicit action). There is no dirty-form state in this codebase and this design
does not introduce one.

**7. No live trajectory while a testcase runs.**

Running a testcase replays entirely on the server — the recorded results are fed back, and
no human supplies anything mid-run. There is nothing to stream. The panel renders the
comparison when the run returns. This differs from the playground's free-run trajectory
view (Task 8), which is interactive because a human types each tool result.

## Data model

```prisma
model TestCase {
    // ...
    expectedSteps  Json?
    lastSteps      Json?
    stepsConfig    Json?
    lastMismatches Json?   // new
}
```

`lastMismatches` holds the `StepMismatch[]` that `compareSteps` returns — the same shape
already crossing the boundary inside `assertionThoughts`, now structured. Null means the
testcase has not been run since it became a trajectory, or is not a trajectory at all.

One additive Prisma migration. No row is rewritten.

## API

`TestcasesUpdateSchema` already accepts `expectedSteps`, `lastSteps` and `stepsConfig`.
Three changes:

- `expectedSteps` accepts `null` in addition to a valid step array. `null` means clear.
- `stepsConfig` likewise.
- `trajectoryColumns` maps `null` to `Prisma.DbNull` and leaves `undefined` skipped. This
  is the whole of the Task 7 limitation.

`lastMismatches` is **not** writable through the update schema. It is derived from a
comparison the server performed and accepting it from a client would let an author claim a
verdict's explanation without a run having produced it.

An update carrying `expectedSteps: null` also writes `stepsConfig` and `lastMismatches` as
`Prisma.DbNull`, whatever the client sent for them (decision 4).

`runTestcase` additionally persists `lastMismatches` on a trajectory run, and clears it on
a text run so a testcase that loses its trajectory cannot keep a stale explanation.

The read path needs no change: `getTestcaseById` and the list endpoint already return the
whole row.

## Web

**Types.** `TestCase` gains `expectedSteps?: Step[]`, `lastSteps?: Step[]`,
`stepsConfig?: StepsConfig`, `lastMismatches?: StepMismatch[]`. `StepMismatch` joins
`Step`/`ArgsMatch` in `apps/web/src/types/steps.ts`, restated from core with the same
"not imported, mirrored" comment and drift assertion the existing mirrors carry.

**`TrajectoryPanel`** — a new component in the playground, rendered when the open testcase
has `expectedSteps`. One row per step:

- a checkbox bound to `enabled`
- for a tool call: the name, its arguments, and a matcher select (`exact` / `subset` /
  `ignore`)
- for the final step: its text is edited by the expected-output editor per decision 3 and is
  not repeated in the list, but its checkbox and its outcome sit beside that editor, so
  every step's state is visible in one place
- the last run's outcome for that step, from `lastMismatches`: matched, mismatched with the
  reason, or not asserted
- a header line naming the last run's time, or saying the testcase has not been run

Below the list, an `orderMatters` toggle and the step count.

The row — checkbox, name, arguments, matcher select — is extracted from
`TestcaseStepPickerDialog` into a shared `StepRow` component that takes the last run's
outcome as an optional prop, and the dialog is refactored onto it. The two surfaces render
the same thing and would otherwise drift; the dialog keeps its own behaviour (it edits a
candidate trajectory, not a saved one) and only loses its private copy of the row.

**`LogDetailsDialog`** — a read-only section listing the trace's steps, shown when the log
has `trace_id`. Loading and failure states are explicit: a trace whose spans cannot be read
says so rather than rendering an empty list, for the same reason Task 9's toast distinguishes
a failed trajectory load from a testcase with no steps.

**Testcase list** — a marker on a trajectory testcase (icon plus step count) in
`useTestcasesColumns`, so it is distinguishable from a text one.

## Error handling

- A save that fails leaves the control showing the persisted value, not the attempted one,
  and surfaces a toast. A checkbox that silently stays flipped while the server rejected the
  write is the failure this rule exists to prevent.
- Unticking the last enabled step does not send a request that the boundary will reject. The
  panel offers the trajectory-removal action instead.
- `lastMismatches` that fails to parse is treated as absent — the panel shows the steps with
  no per-step outcome rather than breaking. Same posture as `readExpectedSteps`.
- A trace that will not load in the log dialog is reported in place; the add-testcase button
  keeps working, since it has its own fallback.

## Testing

- `trajectoryColumns`: `undefined` skipped, a value passed through, `null` mapped to
  `Prisma.DbNull`. This is the Task 7 limitation and it gets a direct test.
- `TestcasesUpdateSchema`: `null` accepted for `expectedSteps` and `stepsConfig`; an
  all-unticked array still rejected; a valid array still accepted.
- `runTestcase`: `lastMismatches` written on a trajectory run and matching what
  `compareSteps` returned; cleared on a text run.
- Clearing: an update with `expectedSteps: null` leaves the row a text testcase, with
  `stepsConfig` and `lastMismatches` also null and `expectedOutput` intact.
- Web: the `StepMismatch` mirror's drift assertion. `apps/web` has vitest as of Task 9;
  pure mapping logic is tested there, components are not.

## Non-goals

- Re-pinning the last run as the new expectation in one action. Considered and dropped for
  this pass.
- Recomputing the verdict when expectations change (decision 2).
- Editing a trajectory anywhere other than the playground.
- Adding steps by hand. A step's `recordedResult` comes from a real run, and a hand-written
  step would have none — it could be asserted but never replayed.
- Changing how `assertionThoughts` reads. It stays the prose summary; `lastMismatches` is
  the structured form beside it.
