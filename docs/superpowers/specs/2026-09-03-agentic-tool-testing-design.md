# Agentic tool testing

**Date:** 2026-09-03

## Goal

Let a prompt author take an agentic run that went wrong, turn it into a testcase in one click, and
have that testcase fail when the prompt starts calling the wrong tool or passing the wrong
arguments.

A run stops being a single `input -> output` pair and becomes a **trajectory**: a sequence of tool
calls with their arguments and results, ending in a final answer. A testcase pins the part of that
trajectory the author marks as load-bearing.

Tools are never executed by Genum. On replay, a tool's result comes from the recorded run — the
trace is the mock.

## What exists today

**Tools are already defined, already sent, and already answered.** `ModelConfigParameters` carries
them (`apps/core/src/ai/models/types.ts:95`, shape at `FunctionCallSchema`, `types.ts:36`), they live
in `Prompt.languageModelConfig`, and all four providers map them onto their wire format:
`openai/generate.ts:21`, `anthropic/generate.ts:18` via `mapToolsAnthropic`, `deepseek/generate.ts:29`
via `mapToolsDeepSeek`, `gemini/utils.ts:124` via `functionDeclarations`.

The gap is on the way back. A tool call returns as a **provider-specific JSON string inside a text
field**:

```ts
// apps/core/src/ai/providers/openai/utils.ts:18
} else if (message.type === "function_call") {
    return JSON.stringify({ id: message.call_id, name: message.name,
                            arguments: JSON.parse(message.arguments) });
```

```ts
// apps/core/src/ai/providers/anthropic/generate.ts:25
} else if (message.type === "tool_use") {
    result = JSON.stringify(message);   // raw SDK block: { type, id, name, input }
```

Same information, two incompatible shapes — `arguments` against `input`, plus Anthropic's `type` —
both landing in `ProviderResponse.answer: string` (`providers/index.ts:21`) and from there in
`LogDocument.out`. **This is why "check the parameters" is impossible today:** an assertion on
`args.city` would have to parse a different JSON per vendor out of a text field.

Two further limits follow from the same code. Both providers read **only the first output item**
(`openai/generate.ts:31` filters then takes `[0]`; `anthropic/generate.ts:22` takes
`response.content[0]`), so parallel tool calls are silently dropped. And there is no loop: one
provider call is the whole run, so a tool call is where the run *ends*, never a step it passes
through.

**The log is flat.** `logs` is one row per run with `in String, out String`
(`apps/core/clickhouse/migrations/20260902000000_init.sql:28`) — no `trace_id`, no parent, no step.

**The testcase is single-shot text.** `TestCase` holds `input`, `expectedOutput`, `lastOutput` as
plain strings (`apps/core/prisma/models/testcase.prisma:13-16`), and the assertion compares two
strings (`getTestcaseStatus(run.answer, testcase.expectedOutput)`,
`controllers/testcase.controller.ts:198`).

**The trace-to-testcase path already exists** and already carries context:
`useAddTestcaseFromLog.ts` maps `log.in -> input`, `log.out -> expectedOutput`, and transfers
`log.placeholders`, warning about values that could not follow. This design extends that action; it
does not replace it.

## Decisions

Settled in brainstorming, recorded because each closes off a different design:

1. **Tools stay in `languageModelConfig`.** A project-level tool registry was considered and
   rejected: a tool's `description` steers the model's choice, so it is part of the prompt, and a
   shared definition edited elsewhere would change a *committed* prompt's behaviour. The cost —
   the same tool redescribed on five prompts — is accepted; "copy tools from another prompt" solves
   it later without a schema change.
2. **Correctness is a chosen subset of steps, not the whole chain and not the last message.**
   Whole-chain strict matching goes red on every model upgrade, because step order and retries vary.
   Last-message matching misses the bug that motivates the feature: a wrong `send_mail` recipient is
   invisible in a final answer that says "sent".
3. **The subset is chosen when the testcase is created**, not in prompt settings. That is the moment
   the author is already looking at the failed run and knows what broke.
4. **Default selection is every tool call plus the final answer; order does not matter by default.**
5. **A tool is never executed.** Replay feeds the result recorded in the original run.
6. **A tool call with no recorded result fails the test loudly**, naming the tool. Substituting an
   empty result would fail later in the chain and report the wrong cause.
7. **Trajectories are telemetry, expectations are product data.** Spans go to ClickHouse under
   retention; a testcase *copies* the steps it pins into Postgres, so it survives log cleanup. Same
   principle as placeholder snapshots on `PromptVersion`.
8. **`AssertionType` is reused, not extended.** `STRICT`, `AI` and `MANUAL` all have a meaning over a
   trajectory.

## Normalized tool calls

The foundation, because nothing else can be asserted on until it exists.

```ts
// apps/core/src/ai/providers/index.ts
export type ToolCall = {
    id: string;
    name: string;
    args: Record<string, unknown>;
};

export type ProviderResponse = {
    answer: string;
    toolCalls?: ToolCall[];   // new — one shape for every vendor
    // ... tokens, response_time_ms, chainOfThoughts, status unchanged
};
```

Each provider fills it: OpenAI from `function_call` items, Anthropic from `tool_use` blocks,
DeepSeek from `tool_calls`, Gemini from `functionCall` parts. Two rules apply to all four:

- **Every output item is read**, not just `[0]`, so parallel tool calls survive.
- **`answer` keeps its current value.** Single-shot runs, existing testcases and the logs table are
  untouched by this change; `toolCalls` is additive.

## The replay loop

A new entry point beside `runPromptWithProvider`, in `apps/core/src/ai/runner/`. It repeats:

1. Call the provider with the prompt, its tools, and the messages so far.
2. If the response has no `toolCalls`, this is the final answer — stop.
3. For each tool call, look up its recorded result and append it as the tool's response. Continue.

Where the recorded result comes from depends on the caller:

- **Playground**: the author types it in when the run pauses on the call. Nothing is stored on the
  tool definition — decision 1 keeps `FunctionCallSchema` untouched — the value belongs to that run
  and reaches durable storage only when the run becomes a testcase. This is how the first agentic
  trajectories come into existence at all, before any external ingestion exists.
- **Testcase run**: from `expectedSteps[].recordedResult`, matched by tool name and the ordinal of
  that call within the run.

If a tool call has no recorded result, the loop stops and the run is reported as
`tool "send_mail" was called but the recording has no result for it`. Per decision 6 this is a
result, not an error: it is what a changed trajectory looks like.

A step limit guards runaway loops, mirroring `recursionLimit` in `runner/agent.ts:158`.

## Trace spans

`logs` is not restructured. It gains one nullable column and stays the row that the logs list, the
dashboard and every existing ClickHouse query read:

```sql
ALTER TABLE {{DB_NAME}}.logs
    ADD COLUMN IF NOT EXISTS trace_id Nullable(String);
```

Steps go to a new append-only table, named after the OpenTelemetry GenAI semantic conventions so a
later ingestion path is a mapping rather than a rewrite:

```sql
CREATE TABLE IF NOT EXISTS {{DB_NAME}}.trace_spans
(
    timestamp    DateTime64(3) DEFAULT now64(),
    trace_id     String,
    span_id      String,
    parent_span_id Nullable(String),
    span_index   UInt16,               -- position within the trace
    span_type    LowCardinality(String), -- 'llm' | 'tool'

    orgId        UInt32,
    project_id   UInt32,
    prompt_id    UInt32,

    name         String,               -- model name, or tool name
    input        String,
    output       String,
    tool_args    String,               -- JSON, empty for llm spans
    tool_result  String,
    tool_error   Nullable(String),

    vendor       LowCardinality(String),
    model        String,
    tokens_in    UInt32,
    tokens_out   UInt32,
    cost         Float64,
    duration_ms  UInt32,
    status       LowCardinality(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (orgId, project_id, trace_id, span_index)
SETTINGS index_granularity = 8192;
```

The `logs` row is the root span. A log with `trace_id = NULL` is a single-shot run and renders
exactly as it does today.

Both statements ship as one migration through the runner added in
`docs/superpowers/specs/2026-09-02-clickhouse-migrations-design.md`.

## TestCase

The only Prisma change in this design.

```prisma
model TestCase {
    // ... unchanged ...
    expectedSteps Json?   // pinned trajectory
    lastSteps     Json?   // trajectory of the last run
    stepsConfig   Json?   // { orderMatters: false }
}
```

`expectedSteps == null` is today's text testcase, unchanged in behaviour. No data is rewritten.

`expectedSteps` is an ordered array; each step carries its own comparison mode:

```jsonc
[
  { "kind": "tool_call",
    "name": "get_weather",
    "args": { "city": "Berlin" },
    "argsMatch": "exact",                    // exact | subset | ignore
    "enabled": true,
    "recordedResult": "{\"temp\": 12}" },

  { "kind": "tool_call", "name": "search_docs", "enabled": false },

  { "kind": "final", "text": "It is 12° in Berlin", "enabled": true }
]
```

Three fields carry the design:

- **`enabled`** — the checkbox from the step picker. A disabled step is not asserted but stays
  visible, so the author can see what they chose to ignore.
- **`argsMatch`** — `subset` compares only the listed keys. Without it a `request_id` or a timestamp
  in the arguments makes every test permanently red.
- **`recordedResult`** — the mock. It lives inside the testcase, so the test keeps running after the
  ClickHouse rows behind the original trace have aged out.

## Assertion

`testcase.controller.ts` gains a trajectory branch beside the text one; `TestCaseStatus` is
unchanged.

- **`STRICT`** — every enabled step must be present with its `argsMatch` satisfied. Order is
  compared only when `stepsConfig.orderMatters` is true. A missing, extra or mismatched call fails
  and names the step.
- **`AI`** — `testcaseAssertionV2` (`runner/system.ts:112`) is given the expected and actual
  trajectories instead of two strings, and judges equivalence. This covers prompts where a different
  but valid path is acceptable.
- **`MANUAL`** — `NEED_RUN`, as today.

`lastSteps` is written on every run, so the diff between expected and actual is available in the UI
without re-running.

Placeholders keep working as they already do: a testcase pins its placeholder values
(`TestCasePlaceholderValue`), so a trajectory test answers the question no other platform answers —
*in this context, did the prompt pick the right tool?*

## UI

Two additions, both in `apps/web/src/pages/prompt`:

1. **Playground tool step.** When a run returns tool calls, the trajectory renders as a step list and
   the author supplies each tool's result to continue. This is what produces agentic traces.
2. **Step picker on "add testcase from log".** `useAddTestcaseFromLog` currently creates the testcase
   directly. For a log with a `trace_id` it first opens the trajectory with a checkbox per step,
   defaulted per decision 4, and an `argsMatch` selector per tool call. Logs without a `trace_id`
   keep the current one-click behaviour.

## Non-goals

- **External trace ingestion.** The OTLP endpoint that accepts traces from Vercel AI SDK and
  LangChain is the next stage; `trace_spans` is shaped for it, and nothing here has to change to
  accept it.
- Agent graph visualisation.
- Multi-turn sessions.
- Executing tools, in any form.
- Reworking the logs list, the dashboard or existing ClickHouse queries.

## Testing

- **Provider normalization** — a unit test per vendor asserting that a tool-calling response maps to
  the same `ToolCall[]`, including a two-call response that today would lose the second. This is the
  regression that motivates the whole design.
- **Replay loop** — a recorded trajectory replays deterministically; a tool call with no recorded
  result stops the run and names the tool; the step limit terminates a loop.
- **Step comparison** — `exact` fails on a changed argument, `subset` ignores an unlisted key,
  `ignore` passes on any arguments, a disabled step is not asserted, and `orderMatters: false`
  accepts a reordered trajectory.
- **Migration** — `expectedSteps == null` testcases keep their current status after the migration,
  verifying the text path is untouched.

## Files

| Path | Change |
|---|---|
| `apps/core/src/ai/providers/index.ts` | `ToolCall`, `ProviderResponse.toolCalls` |
| `apps/core/src/ai/providers/{openai,anthropic,deepseek,gemini}/` | normalize tool calls; read every output item |
| `apps/core/src/ai/runner/` | replay loop |
| `apps/core/src/services/logger/` | write `trace_spans`, `trace_id` on the log row |
| `apps/core/clickhouse/migrations/` | new migration: `logs.trace_id`, `trace_spans` |
| `apps/core/prisma/models/testcase.prisma` | `expectedSteps`, `lastSteps`, `stepsConfig` |
| `apps/core/src/controllers/testcase.controller.ts` | trajectory assertion branch |
| `apps/web/src/pages/prompt/` | playground step list, step picker on add-from-log |
