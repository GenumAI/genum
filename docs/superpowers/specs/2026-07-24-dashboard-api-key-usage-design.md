# API Key Activity on the project dashboard

**Date:** 2026-07-24

## Goal

Find out whether we log which API key was used, and surface it on the dashboard.

## What already exists

We do log it. The `api_key_id Nullable(UInt32)` column is declared in
`apps/core/clickhouse/init.sql:17`, `logUsage()` writes it
(`apps/core/src/services/logger/logger.ts:178`), and `runPrompt()` passes it through on both
the success and the error path (`apps/core/src/ai/runner/run.ts:206,236`).

Exactly one call site populates it: `ApiV1Controller.runPrompt` passes `api_key_id: key.id`
(`apps/core/src/controllers/apiv1.controller.ts:156`). That is the project's Genum key, the
`ProjectApiKey` model (fields `name`, `publicKey`, `authorId`, `lastUsed`). Runs from the UI
and from testcases write `null`.

What is missing:

- no analytics query in `logger/queries.ts` groups by `api_key_id`;
- `api_key_id` is returned by `transformRowToLogDocument`, but the frontend `Log` type has no
  such field, so it never reaches the UI;
- the dashboard shows nothing about keys.

The AI provider key (OpenAI / Anthropic / Gemini) is not logged anywhere — only `vendor` and
`model`. That is out of scope here.

## Solution

A new **API Key Activity** card on the dashboard page — another slice of data we already
have, modelled on the User Activity card. No ClickHouse migration required.

### Backend

1. `apps/core/src/services/logger/queries.ts` — an `API_KEY_STATS` query:

   ```sql
   SELECT
       api_key_id,
       count() AS total_requests,
       sum(tokens_sum) AS total_tokens_sum,
       sum(cost) AS total_cost,
       max(timestamp) AS last_activity
   FROM ${table}
   WHERE ${where}
   GROUP BY api_key_id
   ORDER BY total_requests DESC
   LIMIT 100
   ```

2. `apps/core/src/services/logger/types.ts` — the `ApiKeyUsageStats` interface
   (`api_key_id`, `api_key_name`, `total_requests`, `total_tokens_sum`, `total_cost`,
   `last_activity`) and `ClickHouseApiKeyStatsRow`; an `api_keys: ApiKeyUsageStats[]` field
   on `ProjectDetailedUsageStats`.

3. `apps/core/src/services/logger/logger.ts` — add a query with
   `WHERE ... AND api_key_id IS NOT NULL` to `getProjectDetailedUsageStats`, the same way it
   is already done for `user_id`. Rows with `null` (UI and testcases) are filtered out: the
   card is about keys, not about all traffic.

   The ClickHouse row → `ApiKeyUsageStats` mapping lives in its own module,
   `logger/mappers.ts`, as the exported pure function `mapApiKeyStatsRow`. Keeping it out of
   `logger.ts` matters: `logger.ts` imports `@/env`, which validates the environment at
   import time and would fail the unit test. That function is what the test covers.

4. `apps/core/src/controllers/project.controller.ts` — in `getProjectDetailedUsageStats`,
   enrich the slice with names via the existing `db.project.getProjectApiKeys(projID)`
   (a project has few keys, so no new repository method is needed). A key that no longer
   exists in Postgres resolves to `api_key_name: null`.

### Frontend

5. `apps/web/src/api/project/project.api.ts` — the `UsageApiKeyStat` interface and an
   `api_keys` field on `UsageData`.

6. `apps/web/src/pages/dashboard/components/ApiKeyActivityTable.tsx` — a new card structured
   after `UserActivityTable`: TanStack Table, per-column sorting, skeleton, and `EmptyState`
   when there is no data.

   Columns: **API Key**, **Total Requests**, **Total Tokens**, **Total Cost**, **Last Used**.
   There is no First Used column.

   A key with no name renders as `Key #<id> (deleted)`, mirroring how `UserActivityTable`
   renders `User ${row.user_id}`.

7. `apps/web/src/pages/dashboard/Dashboard.tsx` — the card renders below `UserActivityTable`,
   in both branches: skeleton and content.

## Decisions

**Double counting stays.** API calls log `user_id: key.authorId`, so the same request is
visible both in User Activity (against the key's author) and in the new table. It is just
another independent slice of the same logs, like the per-model and per-prompt slices.
`USER_STATS` is left untouched so the numbers people are used to do not shift.

**Rows without a key are hidden.** `api_key_id IS NOT NULL` filters out UI and testcase runs.
Their volume is visible in the other dashboard cards.

## Testing

Tests in this repository are unit-level and colocated (`*.test.ts`); there are no ClickHouse
integration tests. Hence:

- `apps/core/src/services/logger/mappers.test.ts` — covers `mapApiKeyStatsRow`: ClickHouse
  returns numbers as strings and they must come back as numbers, `last_activity` may be
  `null`, and absent aggregates default to `0`.
- `pnpm --filter core type-check`
- `pnpm build`
