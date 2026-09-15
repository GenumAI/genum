# Cache and reasoning tokens in run cost — Design

**Status:** design, awaiting review
**Date:** 2026-09-15

## The problem

A model's price is two numbers, `promptPrice` and `completionPrice` (`apps/core/prisma/models/llm.prisma:14-15`), and a run's cost is two terms (`calculateCost`, `apps/core/src/ai/providers/index.ts`). Every vendor we support now bills cached input at a different rate from uncached input, and each reports cache and reasoning tokens in a different place. We read none of those places, so each provider is wrong in its own direction.

Checked against the SDK type declarations in `apps/core/node_modules` and the vendors' own docs:

| Vendor | What we read | What that number actually holds | Effect today |
|---|---|---|---|
| OpenAI (Responses) | `input_tokens`, `output_tokens` | `input_tokens` **includes** `input_tokens_details.cached_tokens`; `output_tokens` includes `output_tokens_details.reasoning_tokens` | Cached input billed at full input price: **over-bills**. Reasoning is priced correctly but invisible. |
| Anthropic | `input_tokens`, `output_tokens` | `input_tokens` **excludes** `cache_read_input_tokens` and `cache_creation_input_tokens` | Cache tokens not billed at all: **under-bills**. Latent: nothing sets `cache_control`, so both counts are 0 today. |
| Gemini | `promptTokenCount`, `candidatesTokenCount` | `promptTokenCount` **includes** `cachedContentTokenCount`; `candidatesTokenCount` **excludes** `thoughtsTokenCount` and `toolUsePromptTokenCount` sits outside `promptTokenCount` (`totalTokenCount` is the sum of all four) | Cached input **over-billed**; thinking output **under-billed**, often by a multiple on thinking models. |
| DeepSeek | `prompt_tokens`, `completion_tokens` | `prompt_tokens` = `prompt_cache_hit_tokens` + `prompt_cache_miss_tokens`; reasoning is inside `completion_tokens` | Cache hits (about 1/30 of the miss price) billed as misses: **over-bills**. |

The wrong number is not only a report. `runPrompt` hands `cost.total` to `chargeQuota` (`apps/core/src/ai/runner/run.ts:253`), and writes it to `logs.cost`. `logs` is append-only, and it records no split, so every day that passes adds history whose cost can never be recomputed.

## Goals

1. `cost` equals what the vendor bills for the tokens a run used — for all four vendors, on every path that bills: single-shot runs, playground turns, and testcase trajectory replays.
2. Quota is charged that amount.
3. Each run's split — cache read, cache write, reasoning, and the cost of each input part and of output — is recorded in `logs` and shown in the UI in this same iteration.
4. No cache price is ever a hardcoded multiplier.

## Non-goals

- **Cost of ingested OTLP traces.** Stays zero, per `apps/core/clickhouse/migrations/20260910120000_span_source.sql`. Cache and reasoning attributes on ingested spans are not read either.
- **`trace_spans` columns.** Our own spans carry zero placeholders for usage (`apps/core/src/services/logger/spans.ts:167-174`); real usage lives only in `logs`.
- **Enabling prompt caching on Anthropic** (`cache_control`). This design makes it safe to enable; it does not enable it.
- **Anthropic's 1-hour cache write price.** We would only write 5-minute entries, and we write none.
- **Gemini cache storage (per hour), explicit caches, Batch API, data-residency and fast-mode multipliers, server-side tool fees.** None of them is used.
- **Per-category dashboard aggregates.** Dashboard queries keep summing `cost` and `tokens_*`, which become correct without being touched.
- **Backfilling history.** There is nothing to backfill from.
- **Entering cache prices for custom providers.** There is no price form for custom models in the web app today; their cache prices stay null and fall back (D3).
- **Refreshing stale registry entries** (for example Anthropic models the vendor has since retired). Separate change.

## Decisions

**D1. Cache prices are absolute, per model — never a multiplier of the input price.** The ratio is not constant per vendor and not reliably per model family. OpenAI's cached input costs 50% of input on `gpt-4o`, 25% on `gpt-4.1`/`o3`/`o4-mini`, and 10% on `gpt-5.x`. Anthropic's cache read is 0.1x, except Claude Fable 5.1 and Mythos 5.1, where it is 0.025x. DeepSeek's cache hit is about 1/30 of the miss price. Gemini's varies by model and, on some models, by modality. A multiplier would be a bug waiting for the next model launch.

**D2. Totals include their parts.** This follows the OpenTelemetry GenAI semantic conventions (`gen_ai.usage.input_tokens` includes `cache_read` and `cache_creation`; `output_tokens` includes `reasoning`). We adopt that meaning, not the attribute names; the conventions have moved repositories and their stability status was not verified. `prompt` counts every input token and `completion` every output token; `cacheRead`, `cacheWrite` and `reasoning` are subsets.

The alternative — disjoint buckets, with `prompt` meaning uncached input only — was rejected. It would silently change what `tokens_in` means for new rows while every `sum(tokens_in)` in `apps/core/src/services/logger/queries.ts` kept adding old and new rows together. With D2, `tokens_in`/`tokens_out` keep the meaning their names already claim. The Anthropic and Gemini adapters add in the parts those vendors report outside their totals. For Gemini thinking models, `tokens_out` rises for new rows; that is the correction, not a regression.

**D3. A missing cache price falls back to the prompt price.** A run never bills below today's rule. For Anthropic, where today cache tokens are not billed at all, the fallback is strictly more. Custom providers get the fallback automatically because their columns are null.

**D4. Reasoning is a count, never a price.** All four vendors bill reasoning tokens at the output rate. It is recorded and displayed, but priced only as part of `completion`. Anthropic's usage has no reasoning count, so its `reasoning` is always 0. Therefore 0 means "none, or not reported by the vendor", and the UI never displays a reasoning row whose value is 0.

**D5. Every place that enumerates usage fields is either removed or made a compile error to miss.** The defect this design most fears is not a wrong formula; it is a new field that silently reaches one code path and not another. See "Summing turns".

**D6. The split is shown in the UI now, in the log details dialog and the playground's run metrics.** The logs list and `StepMetrics` keep showing single totals; they are compact per-row displays, and their totals become correct.

**D7. `logs` stores the cost split, not only the token split.** A breakdown of an old row cannot be derived later from its token counts. Prices change, and DeepSeek's depend on the time of day the run was billed. The row must carry the amounts it was billed.

## Normalized usage

`ProviderResponse.tokens` (`apps/core/src/ai/providers/index.ts`) becomes:

```ts
tokens: {
	prompt: number;      // every input token, cache read and cache write included
	completion: number;  // every output token, reasoning included
	total: number;
	cacheRead: number;   // subset of prompt
	cacheWrite: number;  // subset of prompt
	reasoning: number;   // subset of completion
};
```

The new fields are required, not optional: an optional field lets a provider omit it, and an omitted field reads as a measured zero. Each adapter must state all six.

| Field | OpenAI (Responses) | Anthropic | Gemini | DeepSeek |
|---|---|---|---|---|
| `cacheRead` | `input_tokens_details.cached_tokens` | `cache_read_input_tokens` | `cachedContentTokenCount` | `prompt_cache_hit_tokens`, else `prompt_tokens_details.cached_tokens` |
| `cacheWrite` | 0 (no write fee) | `cache_creation_input_tokens` | 0 (no write fee on implicit caching) | 0 (no write fee) |
| `prompt` | `input_tokens` | `input_tokens + cacheRead + cacheWrite` | `promptTokenCount + toolUsePromptTokenCount` | `prompt_tokens` |
| `reasoning` | `output_tokens_details.reasoning_tokens` | 0 (not reported) | `thoughtsTokenCount` | `completion_tokens_details.reasoning_tokens` |
| `completion` | `output_tokens` | `output_tokens` | `candidatesTokenCount + reasoning` | `completion_tokens` |
| `total` | `total_tokens` | `prompt + completion` | `totalTokenCount` | `total_tokens` |

Every read defaults to 0 when absent. That also fixes an existing defect on the lines being rewritten: `Number(response.usage?.input_tokens)` in `apps/core/src/ai/providers/openai/generate.ts` yields `NaN` when a custom OpenAI-compatible provider returns no usage. DeepSeek's `prompt_cache_hit_tokens` is a vendor extension absent from the OpenAI SDK's types; it is read through a narrow local type, not a cast to `any`.

## Prices

**Schema.** `LanguageModel` gains `cacheReadPrice Float?` and `cacheWritePrice Float?`, in USD per 1M tokens like the existing two. A Prisma migration `<timestamp>_add_model_cache_prices`, nullable, no data step: registry models receive values through the existing registry sync.

**Registry.** `.pricing(prompt, completion, modifier?)` becomes `.pricing({ prompt, completion, cacheRead?, cacheWrite? }, modifier?)`. All 40 call sites change anyway, and four positional numbers are easy to transpose. Values come from each vendor's official pricing page at implementation time; the plan records the table with its retrieval date. Where a vendor publishes no cached price for a model, the field is left out, and D3 applies.

**Fields that enumerate prices** — each must carry the two new ones:
`SeedModelFields`, `ModelBuilderState`, `build()` and `toLanguageModelData` (`apps/core/src/ai/models/builder.ts`); `isModelDifferent` (`apps/core/src/database/seed/models/index.ts`), without which a changed cache price never reaches the database; `createModel` and `updateModel` (`apps/core/src/database/repositories/PromptsRepository.ts:366-398`).

**Resolution.** `Prices` (`apps/core/src/ai/models/pricing.ts`) becomes `{ prompt, completion, cacheRead, cacheWrite }`, all non-null. `getEffectivePrices` takes the model row instead of four positional arguments and applies D3. `PriceModifier` returns a full `Prices`. DeepSeek's `timeOfDayPricing` peak and off-peak objects gain `cacheRead`; the implementation confirms against DeepSeek's official page that the off-peak discount applies to cache hits too.

## Cost

`calculateCost(tokens, prices)` returns:

```ts
{
	promptUncached: number; // (prompt - cacheRead - cacheWrite) × prices.prompt
	cacheRead: number;      // cacheRead × prices.cacheRead
	cacheWrite: number;     // cacheWrite × prices.cacheWrite
	prompt: number;         // promptUncached + cacheRead + cacheWrite
	completion: number;     // completion × prices.completion
	total: number;          // prompt + completion
}
```

`prompt`, `completion` and `total` keep their current meaning: the web app already reads them. The three parts are additive. The uncached token count is clamped at 0, so a vendor that reports inconsistent counts can never produce a negative cost. `chargeQuota(cost.total)` is unchanged.

The run endpoint already returns `tokens` and `cost` (`...completion, cost` in `runPrompt`), so the new fields reach the playground with no controller change.

## Logs

**Migration** `apps/core/clickhouse/migrations/<timestamp>_logs_cost_breakdown.sql`: one `ALTER TABLE {{DB_NAME}}.logs` with seven `ADD COLUMN IF NOT EXISTS`, all `DEFAULT 0`:

| Column | Type | Meaning |
|---|---|---|
| `tokens_in_cache_read` | `UInt32` | subset of `tokens_in` |
| `tokens_in_cache_write` | `UInt32` | subset of `tokens_in` |
| `tokens_out_reasoning` | `UInt32` | subset of `tokens_out` |
| `cost_in_uncached` | `Float64` | part of `cost` |
| `cost_in_cache_read` | `Float64` | part of `cost` |
| `cost_in_cache_write` | `Float64` | part of `cost` |
| `cost_out` | `Float64` | part of `cost` |

On new rows, `cost` equals the sum of the four cost parts. On rows written before the migration, all seven are 0 while `cost` may not be. That is how the UI tells "no split was recorded" from "measured zero" (see UI). The `log_id` expression (`20260908120000_logs_log_id_and_placeholders_value_type.sql`) hashes a fixed list of columns and is not modified.

**Code that enumerates `logs` columns** — each gains the seven: the `LogDocument` interface (the new fields required, so every literal must state them — the error path and `transcribe` in `run.ts`, and the OTLP controller, all write zeros); the insert in `logUsage` and `transformRowToLogListEntry` (`apps/core/src/services/logger/logger.ts:172-238`); `LOG_LIST_COLUMNS` (`apps/core/src/services/logger/queries.ts:57-78`). They go in the list columns, not in `GET_LOG_DETAIL`: they are bounded numbers, not payload, and the details dialog reads its figures from the list row.

## Summing turns

`logTrajectoryRun` (`apps/core/src/controllers/testcase.controller.ts:464-492`) writes one root row for a trajectory as `...base` — the **last** turn — overridden by an explicit `reduce` for `tokens_in`, `tokens_out`, `tokens_sum`, `cost` and `response_ms`. A usage field added to `LogDocument` and not to that list is written with the last turn's value instead of the sum. That is wrong, silently, and a single-turn test cannot catch it.

The usage fields of `LogDocument` move into their own interface, `LogUsage`, which `LogDocument` extends: `tokens_in`, `tokens_out`, `tokens_sum`, `cost`, `response_ms` (summed today, deliberately — see the comment on `logTrajectoryRun`), and the seven new columns. A pure `sumUsage(turns: LogUsage[]): LogUsage` in `apps/core/src/services/logger/` sums every field, driven by an exhaustive `const USAGE_FIELDS: Record<keyof LogUsage, true>`. A field added to `LogUsage` and not to that map fails type-check. `logTrajectoryRun` writes `{ ...base, ...sumUsage(turns) }`.

The playground (`apps/core/src/controllers/prompt.controller.ts:148-171`) writes each turn's row by spreading it whole and sums nothing, so it needs no change. The documented rule that a trajectory's cost is `sum(cost)` over its `prs` and `prt` rows applies unchanged to the new columns.

## UI

**Log details dialog** (`apps/web/src/pages/prompt/playground-tabs/logs/components/LogDetailsDialog.tsx:210-280`, the Performance row).
- Tokens: In, Out and Total unchanged. "Cache read", "Cache write" and "Reasoning" cells appear only when their value is greater than 0.
- Cost: the total, as today. When the row has a recorded split (any of the four cost parts is greater than 0), a list beneath it shows Input, Cache read, Cache write and Output; cache rows are shown only when greater than 0.
- A row without a recorded split shows the total alone. It never renders zeros as though they were measured, which is the principle `StepMetrics` already follows.

**Playground run metrics** (`apps/web/src/pages/prompt/playground-tabs/playground/components/settings-block/models-settings/components/SettingsMetrics.tsx`, rendered by `SettingsBar.tsx:75-86`).
- `ExecutionMetrics` adds "Cached tokens", "Cache write tokens" and "Reasoning tokens" under the prompt and completion rows, each shown only when greater than 0.
- `CostBreakdownMetrics` adds "Cache read" and "Cache write" as indented subsets under "Prompt Cost", so Prompt + Completion still visibly adds up to Total.
- The run response types in `models-settings/utils/types.ts` gain the new fields.

**Model prices.**
- `ModelsTable.tsx` gains a "Cached Price" column showing `cacheReadPrice`, or "—" when null.
- `ModelTooltipContent.tsx` gains a "Cached input" row when `cacheReadPrice` is set.
- Cache write price is not displayed: only Anthropic has one and we do not write cache entries. A cache write that does occur still shows in the log split.
- Both price fields reach the web app without a backend change, because `getModels` and `getModelsByOrganization` return whole rows (`PromptsRepository.ts:345-355`). The web model types (`types/AIModel.ts`, `hooks/usePromptsModels.ts`, `api/organization/organization.api.ts`) gain the two fields.

**Unchanged:** `LogsTable` and `StepMetrics` keep showing totals.

## Error handling

- A provider response without usage produces zeros, never `NaN`.
- An uncached count below 0 is clamped to 0.
- `logUsage` still never rejects. The ClickHouse migration must be applied before new code writes rows, and the Prisma columns before the registry sync writes cache prices. `apps/core/docker-entrypoint.sh` runs `db-init` before the server starts, which is `prisma migrate deploy`, then `clickhouse:migrate:prod`, then `seed:prod` (`apps/core/package.json:30`), so the deploy needs no new ordering.

## Behaviour change to announce

Quota charges move per vendor once this ships, and the release notes say so:
- **OpenAI, DeepSeek, and Gemini with cached input:** lower.
- **Gemini thinking models:** higher.
- **Anthropic:** unchanged until caching is enabled.

Rows written before the release show a total with no split.

## Testing

- **Adapters**, one test per vendor, with a usage fixture where every part is non-zero:
  - Anthropic's `prompt` includes both cache counts.
  - Gemini's `completion` includes thoughts and its `prompt` includes tool-use input.
  - DeepSeek reads `prompt_cache_hit_tokens` and falls back to `prompt_tokens_details.cached_tokens`.
  - OpenAI without `usage` yields zeros.
  - Every vendor holds `cacheRead + cacheWrite ≤ prompt` and `reasoning ≤ completion`.
- **`calculateCost`:**
  - the parts sum to `total`;
  - a null cache price falls back to the prompt price;
  - an inconsistent count clamps.
- **`getEffectivePrices`:** DeepSeek resolves `cacheRead` at peak and off-peak; a flat-priced model; a custom model absent from the registry.
- **Registry sync:** `isModelDifferent` reports a change when only a cache price changed; `toLanguageModelData` carries both.
- **`sumUsage`:** two turns with distinct non-zero values in every usage field, where the expected root row is the sum of each. The type-level exhaustiveness is the other half of this test.
- **`logTrajectoryRun`:** two turns with different cache reads produce a root row with their sum, not the second turn's value. This is the regression D5 exists for.
- **Logger:** the insert writes the seven columns, in the existing `logger.test.ts` harness.
- **ClickHouse migration:** applied on dev, `pnpm --filter core clickhouse:status:dev` clean.
- **Web:** it has no test suite, so `pnpm --filter web build` type-checks it. Then check by hand:
  - the playground metrics for a run with cached input on OpenAI and one with thinking on Gemini;
  - a new and a pre-migration row in the log details dialog.

## Files

```
apps/core/prisma/models/llm.prisma                               + cacheReadPrice, cacheWritePrice
apps/core/prisma/migrations/<timestamp>_add_model_cache_prices/  new
apps/core/clickhouse/migrations/<timestamp>_logs_cost_breakdown.sql  new
apps/core/src/ai/providers/index.ts                              ProviderResponse.tokens, calculateCost
apps/core/src/ai/providers/{openai,anthropic,gemini,deepseek}/generate.ts   usage normalization (+ tests)
apps/core/src/ai/models/builder.ts                               pricing({...}), seed fields
apps/core/src/ai/models/pricing.ts                               Prices, getEffectivePrices (+ test)
apps/core/src/ai/models/vendors/*.ts                             cache prices for 40 models
apps/core/src/database/seed/models/index.ts                      isModelDifferent
apps/core/src/database/repositories/PromptsRepository.ts         createModel, updateModel
apps/core/src/ai/runner/run.ts                                   usage row, error row, transcribe row
apps/core/src/services/logger/types.ts                           LogUsage
apps/core/src/services/logger/usage.ts                           sumUsage (+ test)   new
apps/core/src/services/logger/logger.ts                          insert, list row mapping
apps/core/src/services/logger/queries.ts                         LOG_LIST_COLUMNS
apps/core/src/controllers/testcase.controller.ts                 logTrajectoryRun uses sumUsage
apps/core/src/controllers/otlp.controller.ts                     zeros for new fields
apps/web/src/types/logs.ts                                       seven optional fields
apps/web/src/types/AIModel.ts, hooks/usePromptsModels.ts, api/organization/organization.api.ts
apps/web/src/pages/prompt/playground-tabs/logs/components/LogDetailsDialog.tsx
apps/web/src/pages/prompt/playground-tabs/playground/components/settings-block/models-settings/
    components/SettingsMetrics.tsx, SettingsBar.tsx, utils/types.ts
apps/web/src/pages/settings/components/OrgModels/ModelsTable.tsx
apps/web/src/pages/prompt/playground-tabs/playground/components/settings-block/models-settings/
    components/ModelTooltipContent.tsx
```
