# Cache and reasoning tokens in run cost — Design

**Status:** design, revised after an optimality review; implementation plan in
`docs/superpowers/plans/2026-09-15-cache-and-reasoning-cost.md`
**Date:** 2026-09-15

## Revised after review

The first version of this design was reviewed for the cheapest way to meet the same goals. Five changes came out of it:

1. **Cache prices live in the code registry only**, not in two new Postgres columns (D8). The deploy already rewrites every registry model's stored prices from code, so a column would be a mirror with four copy sites.
2. **`logs` gains six columns, not seven**, and every one of them is a subset of a column that already exists (D7). Uncached-input and non-reasoning-output amounts are subtractions, not columns. This also removes the UI's need to tell "not recorded" from "measured zero".
3. **The log details dialog shows "of which" lines** under the totals (cache read, cache write, reasoning), not a full input/output cost split.
4. **Two pull requests, backend first** (D9). Every day without the split is history that can never be recovered; the UI can follow.
5. **Historical rows are not recomputed.** Nothing was recorded to recompute from — with one exception (Gemini thinking), which gets a read-only query and is not written back (see "Historical rows").

The review also found registry prices that disagree with the vendors' pages. Correcting base prices is outside this design (see Non-goals), and the affected models get no cache price here.

## The problem

A model's price is two numbers, `promptPrice` and `completionPrice` (`apps/core/prisma/models/llm.prisma:14-15`), and a run's cost is two terms (`calculateCost`, `apps/core/src/ai/providers/index.ts`). Every vendor we support now bills cached input at a different rate from uncached input, and each reports cache and reasoning tokens in a different place. We read none of those places, so each provider is wrong in its own direction.

Checked against the SDK type declarations in `apps/core/node_modules` and the vendors' own docs:

| Vendor | What we read | What that number actually holds | Effect today |
|---|---|---|---|
| OpenAI (Responses) | `input_tokens`, `output_tokens` | `input_tokens` **includes** `input_tokens_details.cached_tokens`; `output_tokens` includes `output_tokens_details.reasoning_tokens` | Cached input billed at full input price: **over-bills**. Reasoning is priced correctly but invisible. |
| Anthropic | `input_tokens`, `output_tokens` | `input_tokens` **excludes** `cache_read_input_tokens` and `cache_creation_input_tokens` | Cache tokens not billed at all: **under-bills**. Latent: nothing sets `cache_control`, so both counts are 0 today. |
| Gemini | `promptTokenCount`, `candidatesTokenCount` | `promptTokenCount` **includes** `cachedContentTokenCount`; `candidatesTokenCount` **excludes** `thoughtsTokenCount`; `toolUsePromptTokenCount` sits outside `promptTokenCount` (`totalTokenCount` is the sum of all four) | Cached input **over-billed**; thinking output **under-billed**, often by a multiple on thinking models. |
| DeepSeek | `prompt_tokens`, `completion_tokens` | `prompt_tokens` = `prompt_cache_hit_tokens` + `prompt_cache_miss_tokens`; reasoning is inside `completion_tokens` | Cache hits (about 1/30 of the miss price) billed as misses: **over-bills**. |

The wrong number is not only a report. `runPrompt` hands `cost.total` to `chargeQuota` (`apps/core/src/ai/runner/run.ts:253`) and writes it to `logs.cost`. `logs` is append-only and records no split, so every day adds history whose cost can never be recomputed.

## Goals

1. `cost` equals what the vendor bills for the tokens a run used — for all four vendors, on every path that bills: single-shot runs, playground turns, and testcase trajectory replays.
2. Quota is charged that amount.
3. Each run records how much of its input was a cache read or a cache write, how much of its output was reasoning, and what each of those cost — and the UI shows it.
4. No cache price is ever a hardcoded multiplier.

## Non-goals

- **Cost of ingested OTLP traces.** Stays zero, per `apps/core/clickhouse/migrations/20260910120000_span_source.sql`. Cache and reasoning attributes on ingested spans are not read either.
- **`trace_spans` columns.** Our own spans carry zero placeholders for usage (`apps/core/src/services/logger/spans.ts:167-174`); real usage lives only in `logs`.
- **Enabling prompt caching on Anthropic** (`cache_control`). This design makes it safe to enable; it does not enable it.
- **Anthropic's 1-hour cache write price.** We would only write 5-minute entries, and we write none.
- **Gemini cache storage (per hour), explicit caches, Batch API, data-residency and fast-mode multipliers, server-side tool fees.** None of them is used.
- **Per-category dashboard aggregates.** Dashboard queries keep summing `cost` and `tokens_*`, which become correct without being touched. The new columns make such aggregates possible later.
- **Recomputing or rewriting history.** See "Historical rows".
- **Cache prices for custom providers.** They have no registry entry; their cache tokens bill at their prompt price (D3).
- **Correcting base prices or model ids in the registry.** Found during the review, each a separate decision:
  - `gpt-5.6-sol` — OpenAI lists $4.00 / $20.00, "promotional pricing … at least through November 21, 2026"; the registry has $5 / $30.
  - `deepseek-v4-flash` — DeepSeek's pricing page lists a model `deepseek-flash` at $0.15 / $0.60 off-peak; the registry has $0.22 / $0.66. `deepseek-v4-pro` matches.
  - `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-3-pro-preview` — no longer on Google's pricing page. `claude-3-7-sonnet-latest` is no longer on Anthropic's.

## Decisions

**D1. Cache prices are absolute, per model — never a multiplier of the input price.** The ratio is not constant per vendor and not reliably per model family. OpenAI's cached input costs 50% of input on `gpt-4o`, 25% on `gpt-4.1`/`o3`/`o4-mini`, and 10% on `gpt-5.x`. Anthropic's cache read is 0.1x, except Claude Fable 5.1 and Mythos 5.1, where it is 0.025x. DeepSeek's cache hit is about 1/30 of the miss price. Gemini's varies by model and, on some models, by modality.

**D2. Totals include their parts.** This follows the OpenTelemetry GenAI semantic conventions (`gen_ai.usage.input_tokens` includes `cache_read` and `cache_creation`; `output_tokens` includes `reasoning`). We adopt that meaning, not the attribute names; the conventions have moved repositories and their stability status was not verified. `prompt` counts every input token and `completion` every output token; `cacheRead`, `cacheWrite` and `reasoning` are subsets.

The alternative — disjoint buckets, with `prompt` meaning uncached input only — was rejected. It would silently change what `tokens_in` means for new rows while every `sum(tokens_in)` in `apps/core/src/services/logger/queries.ts` kept adding old and new rows together. For Gemini thinking models, `tokens_out` rises for new rows; that is the correction, not a regression.

**D3. A missing cache price falls back to the prompt price.** A cached token is never billed below what it was before cache prices existed. For Anthropic, where today cache tokens are not billed at all, the fallback is strictly more.

**D4. Reasoning has no price of its own.** All four vendors bill reasoning tokens at the output rate. Its cost is recorded as a *part* of the output cost: reasoning tokens × output price. Anthropic's usage has no reasoning count, so its `reasoning` is always 0. Therefore 0 means "none, or not reported", and the UI never displays a zero part.

**D5. Every place that enumerates usage fields is either removed or made a compile error to miss.** The defect this design most fears is not a wrong formula; it is a new field that silently reaches one code path and not another. See "Summing turns".

**D6. The split is shown in the UI in the same iteration.** "Of which" lines in the log details dialog and the playground's run metrics; the cached input price on the model table and tooltip. The logs list and `StepMetrics` keep single totals.

**D7. The split is recorded at write time, in ClickHouse, and every new column is a subset of an existing total.**
- *Why record it at all:* the counts exist only in the vendor's response to that one call. Not written then, they are gone.
- *Why ClickHouse, not Postgres:* Postgres has no per-run row, and run logs belong to ClickHouse.
- *Why store cost parts instead of deriving them from counts × prices on read:* prices change, and DeepSeek's depend on the hour the run was billed. A derived part would stop matching the stored `cost` the day a price changes.
- *Why subsets only:* `sum(tokens_in)` and `sum(cost)` keep their meaning, and a zero reads the same on every row — "nothing to show". An old row cannot record a split, and a new row with no cache has none; neither needs a line. A column such as "uncached input cost" would be a subtraction stored twice.

**D8. Cache prices live in the code registry only.** `apps/core/docker-entrypoint.sh` runs `db-init` on every deploy. That is `prisma migrate deploy && clickhouse:migrate:prod && seed:prod` (`apps/core/package.json:30`), and the seed calls `syncModels` (`apps/core/src/database/seed/seed.ts:17`), which rewrites every registry model's stored prices from code. The stored prices of those models are already a mirror, and billing already bypasses them for models with a `priceModifier`.

A Postgres column would add a migration and four copy sites: `SeedModelFields`, `isModelDifferent`, `PromptsRepository.createModel` and `updateModel`. Each would be a place for a cache price to silently not arrive. The cost of registry-only is that the two model-list endpoints attach registry cache prices for display.

**D9. Two pull requests, backend first.** The first bills correctly and records the split; the second shows it. The UI changes nothing the backend depends on, and every day the backend waits is unrecoverable history.

## Normalized usage

`ProviderResponse.tokens` (`apps/core/src/ai/providers/index.ts`) becomes a named type:

```ts
export type TokenUsage = {
	prompt: number;      // every input token, cache read and cache write included
	completion: number;  // every output token, reasoning included
	total: number;
	cacheRead: number;   // subset of prompt
	cacheWrite: number;  // subset of prompt
	reasoning: number;   // subset of completion; 0 when the vendor does not report it
};
```

The new fields are required: an optional field lets a provider omit it, and an omitted field reads as a measured zero.

| Field | OpenAI (Responses) | Anthropic | Gemini | DeepSeek |
|---|---|---|---|---|
| `cacheRead` | `input_tokens_details.cached_tokens` | `cache_read_input_tokens` | `cachedContentTokenCount` | `prompt_cache_hit_tokens`, else `prompt_tokens_details.cached_tokens` |
| `cacheWrite` | 0 (no write fee) | `cache_creation_input_tokens` | 0 (no write fee on implicit caching) | 0 (no write fee) |
| `prompt` | `input_tokens` | `input_tokens + cacheRead + cacheWrite` | `promptTokenCount + toolUsePromptTokenCount` | `prompt_tokens` |
| `reasoning` | `output_tokens_details.reasoning_tokens` | 0 (not reported) | `thoughtsTokenCount` | `completion_tokens_details.reasoning_tokens` |
| `completion` | `output_tokens` | `output_tokens` | `candidatesTokenCount + reasoning` | `completion_tokens` |
| `total` | `total_tokens` | `prompt + completion` | `totalTokenCount` | `total_tokens` |

Every read defaults to 0 when absent. That fixes an existing defect on the lines being rewritten: `Number(response.usage?.input_tokens)` in `apps/core/src/ai/providers/openai/generate.ts` yields `NaN` when a custom OpenAI-compatible provider returns no usage. DeepSeek's `prompt_cache_hit_tokens` is a vendor extension absent from the OpenAI SDK's types; it is read through a narrow local type, not a cast to `any`.

## Prices

**Registry.** `BuiltModel` (`apps/core/src/ai/models/builder.ts`) gains optional `cacheReadPrice` and `cacheWritePrice`, in USD per 1M tokens and code-side only, like `priceModifier`. `.pricing(prompt, completion, modifier?)` becomes `.pricing({ prompt, completion, cacheRead?, cacheWrite? }, modifier?)`: all 40 call sites change anyway, and four positional numbers are easy to transpose. `PriceModifier` returns the same object shape (`ListedPrices`).

**Values.** Taken from each vendor's official pricing page on 2026-09-15; the plan lists them per model. A cache price is left out, and D3 applies, where:
- the vendor publishes none: `o3-pro`, `gpt-5-pro`, `gpt-5.5-pro`;
- the model is no longer on the vendor's page: `claude-3-7-sonnet-latest`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-3-pro-preview`;
- the registry's base price disagrees with the vendor's: `gpt-5.6-sol`, `deepseek-v4-flash`.

**Resolution** (`apps/core/src/ai/models/pricing.ts`).
- `Prices` becomes `{ prompt, completion, cacheRead, cacheWrite }`, all non-null.
- `getEffectivePrices(model)` takes the model row instead of four positional arguments. It reads base prices from the row, cache prices from the registry, and applies D3. A model with a `priceModifier` resolves all four at call time; DeepSeek's off-peak discount applies to cache hits too, as DeepSeek's page states.
- `withCachePrices(model)` attaches the registry's cache prices to a model row for display, or `null`.

## Cost

`calculateCost(tokens: TokenUsage, prices: Prices)` returns:

```ts
{
	prompt: number;      // (prompt - cacheRead - cacheWrite) × prices.prompt + cacheRead + cacheWrite
	completion: number;  // completion × prices.completion
	total: number;       // prompt + completion
	cacheRead: number;   // cacheRead × prices.cacheRead          — part of prompt
	cacheWrite: number;  // cacheWrite × prices.cacheWrite        — part of prompt
	reasoning: number;   // reasoning × prices.completion         — part of completion
}
```

`prompt`, `completion` and `total` keep their current meaning, which the web app already reads. The uncached count is clamped at 0, so inconsistent vendor counts never produce a negative cost. `chargeQuota(cost.total)` is unchanged. The run endpoint already returns `tokens` and `cost` (`...completion, cost`), so the new fields reach the playground with no controller change.

## Logs

**Migration** `apps/core/clickhouse/migrations/20260915120000_logs_usage_split.sql` is one `ALTER TABLE {{DB_NAME}}.logs` with six `ADD COLUMN IF NOT EXISTS`, all `DEFAULT 0`:

| Column | Type | A part of |
|---|---|---|
| `tokens_in_cache_read` | `UInt32` | `tokens_in` |
| `tokens_in_cache_write` | `UInt32` | `tokens_in` |
| `tokens_out_reasoning` | `UInt32` | `tokens_out` |
| `cost_in_cache_read` | `Float64` | `cost` |
| `cost_in_cache_write` | `Float64` | `cost` |
| `cost_out_reasoning` | `Float64` | `cost` |

The `log_id` expression (`20260908120000_logs_log_id_and_placeholders_value_type.sql`) hashes a fixed list of columns and is not modified.

**Code that enumerates `logs` columns:**
- `LogUsage` (see below), which `LogDocument` extends and whose fields are required.
- The insert in `logUsage` and `transformRowToLogListEntry` (`apps/core/src/services/logger/logger.ts:172-238`). The second is forced by its return type.
- `ClickHouseLogListRow` (`apps/core/src/services/logger/types.ts:245`).
- `LOG_LIST_COLUMNS` (`apps/core/src/services/logger/queries.ts:57-78`). Its type cannot catch a missing column (`types.ts:241-243` says so), so a test asserts every usage field is named there.

The new columns go in the list columns rather than in `GET_LOG_DETAIL`: they are bounded numbers, not payload, and the details dialog reads its figures from the list row.

## Summing turns

`logTrajectoryRun` (`apps/core/src/controllers/testcase.controller.ts:464-492`) builds a trajectory's root row as `...base` — the **last** turn — overridden by an explicit `reduce` for `tokens_in`, `tokens_out`, `tokens_sum`, `cost` and `response_ms`. A usage field added to the row and not to that list is written with the last turn's value instead of the sum: silently wrong, and invisible to a single-turn test.

The usage fields move into their own interface, `LogUsage`: `tokens_in`, `tokens_out`, `tokens_sum`, `cost`, `response_ms` (summed today, deliberately — see the comment on `logTrajectoryRun`), and the six new columns. `LogDocument` extends it.

`apps/core/src/services/logger/usage.ts` holds the single list of those fields and the sum over it:
- `ZERO_USAGE: Readonly<LogUsage>` is the one list. A fresh object literal typed `LogUsage` fails type-check on a missing or an extra field.
- `sumUsage(turns)` sums exactly `ZERO_USAGE`'s keys.

`logTrajectoryRun` writes `{ ...base, ...sumUsage(turns) }`. The rows that carry no usage — the error row and the transcription row in `run.ts`, and the OTLP row in `otlp.controller.ts` — spread `ZERO_USAGE` instead of listing five zeros each.

The playground (`apps/core/src/controllers/prompt.controller.ts:148-171`) writes each turn's row by spreading it whole and sums nothing, so it needs no change. The documented rule that a trajectory's cost is `sum(cost)` over its `prs` and `prt` rows applies unchanged to the new columns.

## UI

**Log details dialog** (`apps/web/src/pages/prompt/playground-tabs/logs/components/LogDetailsDialog.tsx:210-280`, the Performance row):
- Under the In / Out / Total token grid, a line for each of "Cache read", "Cache write" and "Reasoning" greater than 0.
- Under the cost total, the same three as dollar amounts, each when greater than 0.

**Playground run metrics** (`apps/web/src/pages/prompt/playground-tabs/playground/components/settings-block/models-settings/components/SettingsMetrics.tsx`):
- `ExecutionMetrics` gains nested "Cache read" and "Cache write" rows under "Prompt tokens", and "Reasoning" under "Completion tokens".
- `CostBreakdownMetrics` gains the same nested rows under "Prompt Cost" and "Completion Cost".
- Each row appears only when greater than 0, so Prompt + Completion still visibly adds up to Total.

**Model prices:**
- `ModelsTable.tsx` gains a "Cached Price" column, "-" where none is listed.
- `ModelTooltipContent.tsx` gains a "Cached input" row when a price is listed.
- Both use a formatter that keeps sub-cent prices visible: the existing `toFixed(2)` would show `gpt-5-nano`'s $0.005 as $0.01.
- The cache write price is not displayed. Only Anthropic has one, and we write no cache entries; a write that does occur still shows in the split.

**Unchanged:** `LogsTable`, `StepMetrics`, and the dashboard.

## Historical rows

Rows written before the migration cannot be given a split: the vendor counts were never recorded.

One vendor is partly recoverable. For Gemini, `tokens_sum` is `totalTokenCount`, while `tokens_in` and `tokens_out` omitted thoughts and tool-use input. So `tokens_sum - tokens_in - tokens_out` on those rows is exactly the output (and tool-use input) we did not bill.

It is **not** written back:
- quota was already charged at the old figure;
- `logs` is append-only;
- a mutation of `prod.logs` would make the stored `cost` disagree with what the organisation paid.

This read-only query sizes it; multiply by each model's output price for dollars:

```sql
SELECT model,
       count() AS runs,
       sum(toInt64(tokens_sum) - tokens_in - tokens_out) AS unbilled_tokens
FROM logs
WHERE vendor = 'GOOGLE' AND tokens_sum > tokens_in + tokens_out
GROUP BY model
ORDER BY unbilled_tokens DESC
```

## Error handling

- A provider response without usage produces zeros, never `NaN`.
- An uncached count below 0 is clamped to 0.
- `logUsage` still never rejects.
- The ClickHouse migration must be applied before new code writes rows. `db-init` applies it before the server starts, so the deploy needs no new ordering.

## Behaviour change to announce

Quota charges move per vendor once the first pull request ships, and its release notes say so:
- **OpenAI, DeepSeek, and Gemini with cached input:** lower.
- **Gemini thinking models:** higher.
- **Anthropic:** unchanged until caching is enabled.

Rows written before the release show totals with no "of which" lines.

## Testing

- **Adapters**, one test per vendor with every part non-zero:
  - Anthropic's `prompt` includes both cache counts.
  - Gemini's `completion` includes thoughts and its `prompt` includes tool-use input.
  - DeepSeek reads `prompt_cache_hit_tokens` and falls back to `prompt_tokens_details.cached_tokens`.
  - OpenAI without `usage` yields zeros.
- **`calculateCost`:**
  - cached input is billed at the cache price and only the rest at the prompt price;
  - reasoning is a share of `completion`, not added to it;
  - inconsistent counts clamp.
- **`getEffectivePrices`:**
  - registry cache prices for a flat-priced model;
  - Anthropic's cache write;
  - the fallback for a model without a cache price and for a custom model;
  - DeepSeek's cache hit at peak and off-peak.
- **Registry invariant:** every listed cache read is below its model's prompt price, and every cache write at or above it. This catches transposed values.
- **`sumUsage`:** every field summed across three turns; `LOG_LIST_COLUMNS` names every usage field.
- **`logTrajectoryRun`:** two turns with different cache reads give a root row with their sum, not the second turn's value. It fails against the first refactor, before the new fields are summed — that is the regression D5 exists for.
- **`runPrompt`:** the row written to ClickHouse carries the split and costs computed from the registry.
- **Model lists:** `getModelsForOrganization` attaches registry cache prices, and `null` for a custom model.
- **Web:** unit tests for the formatter and the split helpers; `pnpm --filter web build` type-checks. Then by hand:
  - the playground for a cached OpenAI run and a Gemini thinking run;
  - a new row and a pre-migration row in the log details dialog;
  - the model table.

## Files

```
PR 1 — bill correctly, record the split
apps/core/src/ai/providers/index.ts                              TokenUsage, RunCost, calculateCost
apps/core/src/ai/providers/index.test.ts                         new
apps/core/src/ai/providers/{openai,anthropic,gemini,deepseek}/generate.ts (+ .test.ts)
apps/core/src/ai/models/builder.ts                               ListedPrices, cache prices on BuiltModel
apps/core/src/ai/models/pricing.ts                               Prices, getEffectivePrices, withCachePrices (+ test)
apps/core/src/ai/models/vendors/{openai,anthropic,gemini,deepseek}.ts   cache prices
apps/core/src/ai/runner/run.ts                                   prices, cost, usage rows
apps/core/clickhouse/migrations/20260915120000_logs_usage_split.sql   new
apps/core/src/services/logger/types.ts                           LogUsage, ClickHouseLogListRow
apps/core/src/services/logger/usage.ts                           ZERO_USAGE, sumUsage   new (+ test)
apps/core/src/services/logger/logger.ts                          insert, list row mapping
apps/core/src/services/logger/queries.ts                         LOG_LIST_COLUMNS
apps/core/src/controllers/testcase.controller.ts                 logTrajectoryRun
apps/core/src/controllers/otlp.controller.ts                     ZERO_USAGE

PR 2 — show it
apps/core/src/services/prompt.service.ts, organization.service.ts   withCachePrices on model lists
apps/web/src/lib/usageDisplay.ts                                 new (+ test)
apps/web/src/types/AIModel.ts, types/logs.ts, api/organization/organization.api.ts, api/prompt/prompt.api.ts
apps/web/src/pages/settings/components/OrgModels/ModelsTable.tsx
apps/web/src/pages/prompt/playground-tabs/logs/components/LogDetailsDialog.tsx
apps/web/src/pages/prompt/playground-tabs/playground/hooks/types.ts
apps/web/src/pages/prompt/playground-tabs/playground/components/settings-block/models-settings/
    SettingsBar.tsx, components/SettingsMetrics.tsx, components/ModelTooltipContent.tsx, utils/types.ts
```
