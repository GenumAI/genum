---
name: verifying-changes
description: Use when checking genum changes before committing or opening a PR, when writing a PR's Verification section, or when a repo-wide lint/format/test command comes back red and you need to know whether it is your change or the baseline.
---

# Verifying Changes (genum)

## Overview

In this monorepo the repo-wide gates are **red on `main`**, and one documented command does not exist at all. "Green" here means **your changed files add no new problems**, not "the command exits 0". Never report a result you did not see.

CI does not save you: the only PR check is a license scan. Type-check, tests, lint and build run **only on release** — whatever you do not run locally, nobody runs.

## Commands that work

Measured on a clean `main` (2026-07-24, macOS, warm `node_modules`):

| Command | Result | Time |
|---|---|---|
| `pnpm --filter core type-check` | exit 0 — `tsc --noEmit` | ~3 s |
| `pnpm --filter core test:run` | 9 files / 109 tests pass — vitest, unit-only, **no DB or `.env` needed** | ~1 s |
| `pnpm --filter web build` | exit 0 — `tsc -b && vite build` | ~37 s |
| `pnpm exec biome check <paths>` | formatter/linter on the paths you name | <1 s |
| `pnpm --filter web exec eslint <paths>` | paths are **relative to the app dir** | ~5 s |

`web` has **no `type-check` and no tests** — `pnpm --filter web build` is the only way to type-check the frontend.

## Commands that lie — do not trust them

| Command | What actually happens |
|---|---|
| `pnpm test:run` (root) | **Fails always**: turbo has no `test:run` task → `Could not find task 'test:run' in project`. CLAUDE.md documents it anyway. Use `pnpm --filter core test:run`. |
| `pnpm format:check` (root) | Red on `main` (see baseline) — 613 files, 172 errors. If it instead dies with `Found a nested root configuration`, someone dropped `"!.claude"` from `biome.jsonc`: biome is reading a Claude Code worktree's own config. That is never your change. |
| `pnpm lint` (root) | Red on `main` (see baseline). A red exit proves nothing about your change. |
| `pnpm test` (root) | Works (~25 s) but builds **both** apps first; in an interactive TTY vitest stays in watch mode. Prefer `pnpm --filter core test:run`. |
| commit hooks | **There are none.** `lefthook.yml` is fully commented out and no `pre-commit` hook is installed, so `lint-staged.config.mjs` never runs — nothing formats your files for you, despite what CLAUDE.md says. |

## The baseline — measure your delta, not the exit code

On a clean `main` (same run as above):

| Gate | Baseline on `main` |
|---|---|
| `pnpm --filter core lint` | 35 problems — 15 errors, 20 warnings |
| `pnpm --filter web lint` | 354 problems — 112 errors, 242 warnings |
| `pnpm format:check` (biome, whole repo) | 613 files — 172 errors, 237 warnings |

So:

1. **Lint only what you touched** — `pnpm --filter web exec eslint src/pages/Foo.tsx src/hooks/useBar.ts`. Target: **0 new errors** from your files.
2. **Report it relative to the baseline** in the PR: *"`pnpm lint` — 35 problems in core, exactly the `main` baseline; changed files add none."*
3. **Re-measure if the numbers look stale** (`git stash && pnpm --filter core lint`) rather than quoting this table blindly — it moves as PRs land.
4. **Do not "fix" the baseline** inside a feature PR. Repo-wide lint/format cleanups are their own PR; mixing them buries your change under hundreds of unrelated diffs.

## Format your own files — nothing else will

Biome: tabs, indent width 4, line width 100, LF.

```bash
pnpm exec biome check --write apps/core/src/services/foo.ts apps/web/src/pages/Bar.tsx
```

Name the files. `pnpm exec biome check --write .` would rewrite 172 unrelated errors across the repo and bury your diff.

## Prisma-touching changes

`@/prisma` and `@/prisma-types` resolve into generated code under `apps/core/src/.generated/` (never edit it). After changing `apps/core/prisma/schema.prisma`:

```bash
pnpm --filter core db:generate      # regenerate the client
pnpm --filter core db:migrate:dev   # needs postgres up: pnpm dev:infra:up
```

If `type-check` reports missing or stale members on Prisma types, you are type-checking against an old client — regenerate before you believe the errors. Commit the generated migration SQL under `apps/core/prisma/migrations/`, and flag it in the PR's **## Migration** section.

## Minimum bar before opening a PR

- Touched `apps/core` → `pnpm --filter core type-check` **and** `pnpm --filter core test:run`.
- Touched `apps/web` → `pnpm --filter web build`.
- Always → `biome check` and `eslint` on your changed files only.
- Behaviour a command cannot prove (UI, provider calls, ClickHouse data) → say so under **## Not verified** in the PR. **REQUIRED SUB-SKILL:** `creating-pull-requests`.

## Red flags — STOP

- Writing "lint clean" / "all tests pass" for a command you did not run → run it or drop the claim.
- Reporting `pnpm lint` as a failure caused by your change → check it against the baseline first.
- Treating the 172 biome errors or the 35/354 eslint problems as yours → they are the baseline; measure the delta.
- Reformatting files you did not otherwise change → revert; keep the diff reviewable.
- Claiming the frontend type-checks without running `pnpm --filter web build` → there is no other typecheck for `web`.
- Quoting a command from any doc without running it → docs drift (CLAUDE.md advertised the non-existent root `pnpm test:run` and a pre-commit hook that is switched off). This table is measured; re-measure when in doubt.
