# ClickHouse Migrations — Design

**Status:** approved design, not yet implemented
**Date:** 2026-09-02

## The problem

`clickhouse:init` cannot initialise a ClickHouse that does not already have the database, and it reports success when it does nothing.

Verified live rather than read off the code:

- `clickhouseClient` is constructed with `database: env.CLICKHOUSE_DB` (`apps/core/src/services/logger/logger.ts:86-91`), so every statement — including `CREATE DATABASE IF NOT EXISTS` — is sent with a session database that does not exist yet.
- Pointed at a fresh database name, `pnpm --filter core clickhouse:init:dev` printed `ClickHouse database initialized successfully` and exited 0. `system.query_log` recorded **no rows** for that run, and `system.databases` gained nothing.
- A direct probe through the same client returns, for both `SELECT 1` and `CREATE DATABASE IF NOT EXISTS scratch_init_probe`:
  `Database scratch_init_probe does not exist.`
- That message is swallowed by `initializeClickHouse`'s filter (`apps/core/src/services/logger/init.ts:75-87`), which treats an error as benign when the text contains `already exists`, `Table`, `exists` **or `Database`**. The outer `catch` (line 92) rethrows nothing.

So a first deploy into a new environment silently produces no ClickHouse schema, `logUsage` then writes into nothing, and the deploy log says the database was initialised. The observed dev machine has its `logs` table in `default` rather than in the configured database, which is the same class of accident.

This is not primarily a missing-migrations problem — it is a missing-feedback problem. Migrations are the fix that also gives us evidence.

## Goals

1. A fresh environment gets its schema, or the deploy fails loudly.
2. An operator can answer "did the ClickHouse schema change apply?" without hand-writing `DESCRIBE TABLE`.
3. Schema changes that are not expressible as `IF NOT EXISTS` become possible: dropping the frozen `memory_key` column, changing a type, adding a TTL to `logs`, backfilling.
4. An applied migration cannot be edited in place without the tooling noticing.

## Non-goals

- **Down migrations.** ClickHouse DDL is largely irreversible and this store holds append-only run logs. Rolling back means writing a new forward migration.
- **Cluster support.** No `ON CLUSTER`, no `Replicated*` engines, no Keeper anywhere in the repo; `docker-compose.dev.yml` and `docker-compose.build.yml` both run a single node. Migrations are written for a single node. If a cluster ever appears, every DDL needs `ON CLUSTER` and `_migrations` must be replicated — that is a different design, and this document does not pretend to cover it.
- **Concurrent runners.** ClickHouse has no transactions and no advisory locks. Migrations run once per deploy from `docker-entrypoint.sh`, the same assumption `prisma migrate deploy` already makes in that script.
- **Sharing with other repos.** See "Where the code lives".

## Where the code lives

`apps/core`, not a workspace package.

The repo's only package, `packages/placeholders`, exists because **both** apps consume it (`apps/core/package.json` and `apps/web/package.json` both depend on it). ClickHouse has one consumer: `apps/web` contains no ClickHouse reference and cannot have one — it reaches ClickHouse only through core's HTTP API. A package would also put the runner's `__dirname` inside `node_modules`, away from the SQL files in `apps/core/clickhouse/`, which is where today's three-candidate path search came from. And it would add a build step that must run before core type-checks.

The module is nonetheless written as if it were a package, so that extracting it later is a move rather than a rewrite:

```
apps/core/src/clickhouse/
  split.ts     pure: SQL text -> statements
  plan.ts      pure: files + applied rows -> { pending, drifted, missing }
  migrate.ts   applies a plan through an injected client
  status.ts    prints a plan
```

Nothing under `src/clickhouse/` imports `env`, `db`, or the logger. The client and the migrations directory are arguments. It does not live under `services/logger/` — a migration runner is not logging.

## Layout

```
apps/core/clickhouse/migrations/
  20260902000000_init.sql
  20260915103000_drop_memory_key.sql
```

- Filename is `<UTC timestamp>_<slug>.sql`; ordering is lexicographic on the filename, which timestamps make chronological.
- `{{DB_NAME}}` is substituted at runtime, as today, so one migration serves environments with different database names.
- **Migrations must qualify every object with `{{DB_NAME}}`.** An unqualified `CREATE TABLE logs` lands in whatever the session database is; that is exactly how the observed machine ended up with `default.logs`.
- `20260902000000_init.sql` is today's `apps/core/clickhouse/init.sql` verbatim. It is idempotent (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), so on an existing installation it re-applies as a no-op and is simply recorded. **No baseline step is needed**, which is the main reason to keep the first migration byte-identical rather than tidying it.

## Bookkeeping

```sql
CREATE TABLE IF NOT EXISTS {{DB_NAME}}._migrations
(
    name         String,
    checksum     String,
    applied_at   DateTime64(3) DEFAULT now64(),
    execution_ms UInt32
)
ENGINE = ReplacingMergeTree(applied_at)
ORDER BY name;
```

`ReplacingMergeTree` because ClickHouse enforces no uniqueness on insert: two runners racing, or a retry, must not leave two rows that both count. Reads use `SELECT name, checksum FROM {{DB_NAME}}._migrations FINAL`.

**Checksum is sha256 of the raw file bytes, computed before `{{DB_NAME}}` substitution.** Substituting first would give the same migration different checksums in environments with different database names, and every one of them would look like drift.

## The contract

Modelled on `prisma migrate deploy`:

- Apply every migration not present in `_migrations`, in filename order.
- **Drift:** a recorded migration whose file checksum no longer matches → abort before applying anything, name the files, exit non-zero. Never repair automatically. The fix is a new migration, not an edit.
- **Missing:** a recorded migration with no file on disk → abort the same way. Someone deleted history; that needs a human.
- Both checks run against the whole set **before** the first statement is executed, so a run either starts from a consistent picture or does not start.

## Execution and failure

- One connection **without** `database` (the "admin" client) runs `CREATE DATABASE IF NOT EXISTS {{DB_NAME}}` and creates `_migrations`. This is the actual bug fix: the bootstrap cannot be sent to a database that does not exist yet.
- Every migration statement then goes through a client bound to the target database, so an unqualified name resolves there rather than to `default`.
- The substring filter in `init.ts` is deleted outright. An error is an error.
- On the first failing statement: print the migration filename, the statement's index and opening characters, and the server's message; stop; exit non-zero. The failed migration is **not** recorded, so the next run retries it.
- ClickHouse has no transactional DDL, so a migration that fails halfway leaves its earlier statements applied. Therefore: **one file, one logical change**, stated in the migrations directory's own README.

### Statement splitting

Today's splitter cuts on every `;`, which corrupts any statement containing a semicolon inside a string literal — fine for the current DDL, wrong the moment a backfill or a `DEFAULT` string appears. Replaced with a quote-aware splitter: tracks `'...'` (with backslash escapes) and backtick-quoted identifiers, strips `--` line comments outside quotes, splits on `;` outside quotes. Pure, and unit-tested including a literal that contains `;` and one that contains `--`.

## Commands

| Script | Replaces | Purpose |
|---|---|---|
| `clickhouse:migrate:dev` | `clickhouse:init:dev` | apply pending (tsx + dotenv) |
| `clickhouse:migrate:prod` | `clickhouse:init:prod` | apply pending (compiled) |
| `clickhouse:status:dev` / `:prod` | — | print applied / pending / drifted |

`clickhouse:status` exits non-zero on drift or missing files, so CI can gate on it. It is the answer to "did it apply?", which today has no answer short of `DESCRIBE TABLE`.

`db-init` and `dev:db-init` switch to the migrate scripts; they are the only callers, so `clickhouse:init:*` is removed rather than aliased.

`initializeClickHouse` (`services/logger/init.ts`) and `init-clickhouse.ts` are deleted. `init.sql` moves into `migrations/`.

## Deploy impact — accept this deliberately

`apps/core/docker-entrypoint.sh` is `set -e` and runs `pnpm run db-init` before `exec "$@"`. Today the ClickHouse step cannot fail, so it never blocks anything. Once it fails loudly, **a broken or unreachable ClickHouse will stop core from starting.**

That is the intended behaviour and it needs no extra gate. It matches what `prisma migrate deploy` in the same script already does, so the two data stores stop behaving differently. It is a real change for anyone whose ClickHouse is flaky, and it is the point: today that person is running with no run logs and no idea.

Out of scope, worth a separate look: whether `logUsage` failures at request time are surfaced anywhere.

## Testing

The repo's Vitest suites never touch a database, and that is not changing.

**Unit (Vitest):** the pure parts, which are where the logic is.
- `split.ts`: multi-statement files, `--` comments, a literal containing `;`, a literal containing `--`, trailing semicolon, empty input.
- `plan.ts`: pending computed in filename order; drift detected by checksum; a recorded name with no file reported as missing; an empty database yields every file as pending.
- checksum: stable across `{{DB_NAME}}` substitution — the same file checksums identically for two different database names. This one is the reason the whole scheme works, so it is pinned explicitly.

**Manual probe against a scratch ClickHouse in Docker**, output pasted into the PR. Vitest cannot see any of the behaviour that actually broke — today's bug is invisible to code reading and to every existing test. The probe covers:
1. Fresh database name → migrations apply, `system.databases` and `system.columns` show the result, `_migrations` has one row per file.
2. Second run → no statements executed, exit 0.
3. **Positive control:** a deliberately invalid migration → non-zero exit, the server's message printed, and nothing recorded for it. Without this, "the run succeeded" proves nothing — which is the exact failure this whole document exists to remove.
4. Edited applied migration → refused as drift.

## Files

**Created**
- `apps/core/src/clickhouse/split.ts`, `plan.ts`, `migrate.ts`, `status.ts` (+ `split.test.ts`, `plan.test.ts`)
- `apps/core/src/clickhouse/cli/migrate.ts`, `cli/status.ts` — the two entry points
- `apps/core/clickhouse/migrations/20260902000000_init.sql` (moved content)
- `apps/core/clickhouse/migrations/README.md` — the one-file-one-change rule and the `{{DB_NAME}}` requirement

**Modified**
- `apps/core/package.json` — scripts
- `apps/core/src/services/logger/logger.ts` — export a factory for the admin (database-less) client alongside the bound one

**Deleted**
- `apps/core/src/services/logger/init.ts`, `init-clickhouse.ts`, `apps/core/clickhouse/init.sql`
