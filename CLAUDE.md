# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is Genum

An open-source platform to manage, test, and iterate on AI prompts across multiple LLM providers (OpenAI, Anthropic, Gemini, DeepSeek). It ships with a REST API (`apps/core`) and a web UI (`apps/web`).

## Monorepo Layout

```
genum/
├── apps/core/    Node.js + Express + TypeScript + Prisma backend (port 3010)
├── apps/web/     React + Vite + TypeScript frontend (port 3080)
├── docker/
├── .env          Single .env for ALL apps — never create .env in subfolders
└── turbo.json
```

Package manager: **pnpm@10.28.2**. Task runner: **Turborepo**.

## Commands

### Development (no Docker)
```bash
pnpm install
pnpm dev                  # both apps in parallel via Turborepo
pnpm dev:web              # web only
pnpm dev:core             # core only
```

### Docker
```bash
docker-compose up -d           # full stack (prod-like)
docker-compose -f docker-compose.dev.yml up -d   # infra only (postgres, clickhouse, minio)
docker-compose down -v         # remove all data (destructive)
```

### Build & Type Check
```bash
pnpm build                     # turbo build (both apps)
pnpm turbo run type-check --filter=core  # tsc --noEmit for core (turbo builds packages/* first)
```

### Lint & Format
```bash
pnpm lint                      # eslint via turbo
pnpm lint:fix                  # eslint --fix via turbo
pnpm format                    # biome check --write (whole repo)
pnpm format:check              # biome check (no write)
```

### Testing
```bash
pnpm test                            # turbo test (runs build first)
pnpm turbo run test:run --filter=core # core tests only — no watch, no DB needed
pnpm --filter core test:coverage
# Go through turbo, NOT `pnpm --filter core test:run`. Every entry point of
# @genum/placeholders resolves into its dist/, so on a tree that has never been built
# vitest fails to resolve the package and three suites error out. Turbo builds it first.
# `web` has no tests and no type-check; `pnpm --filter web build` type-checks it.
```

### Database (core)
```bash
# Dev: generate client + run migrations + init ClickHouse + seed
pnpm --filter core dev:db-init

# After schema change
pnpm --filter core db:migrate:dev    # prisma migrate dev
pnpm --filter core db:generate       # prisma generate (regenerates .generated/)

# Root shortcuts for the same three (Prisma lives only in apps/core)
pnpm prisma:generate
pnpm prisma:migrate                  # -> core db:migrate:dev
pnpm prisma:studio                   # -> core db:studio, browse the database
```

## Code Style

Formatter: **Biome** — tabs, indent width 4, line width 100, LF line endings.
Linter: ESLint (TypeScript rules). Biome linter also runs but `noExplicitAny` is off.
Pre-commit: **no hook is active** — `lefthook.yml` is commented out, so `lint-staged.config.mjs`
(`biome format --write` then `eslint --fix`) never runs. Format your own changed files.

Lint/format are red on `main` (core 35 problems, web 354, biome 172 errors). Judge your change by
its delta on the files you touched, not by the exit code — see `.claude/skills/verifying-changes/`.

## Architecture

### Backend (`apps/core/src/`)

```
server.ts           Express entry point; calls setupRoutes(), initSystemPromptsConfig()
routes.ts           All route registration; JWT middleware applied globally after /auth
env.ts              Zod-validated env schema (single source of truth for all env vars)
auth/
  jwt.ts            Auth0 JWT validation (cloud mode)
  local/            Cookie-based session auth (self-hosted mode)
  wizard.ts         createAuthMiddleware() — attaches user/org/project to req.genumMeta
database/
  db.ts             Database singleton; all repositories accessed via `db.*`
  prisma.ts         PrismaClient singleton
  repositories/     One repository per domain (Prompts, Testcases, Users, etc.)
ai/
  providers/        OpenAI, Anthropic, Gemini, DeepSeek generation functions
  runner/run.ts     runPromptWithProvider() — routes to correct provider
  models/           Model config/parameter types
erasure/            Account closure: pure tombstone values, relation classification, guard
services/
  logger/           ClickHouse write/query layer for AI usage analytics
  access/           API key quota management
  storage/          MinIO/S3 file operations
controllers/        Request handlers (thin — delegate to services/db)
routers/            Express router factories (one per domain)
```

**Path aliases** (tsconfig):
- `@/*` → `src/*`
- `@/prisma` → `src/.generated/prisma-client/client`
- `@/prisma-types` → `src/.generated/zod/schemas`
- `@/database` → `src/database`

**Prisma client is auto-generated** into `src/.generated/` — never edit those files.

**Instance modes**: `INSTANCE_TYPE=local` (self-hosted, cookie auth) vs `INSTANCE_TYPE=cloud` (Auth0 JWT). Check `isLocalInstance()` from `@/utils/env` for branching logic.

**Request context**: The middleware chain in `wizard.ts` populates `req.genumMeta` with `user`, `organizationMember`, `projectMember`, and `ids`. All protected routes receive this.

**ClickHouse** is append-only for AI run logs (`logUsage()`). Never use it for transactional data — that goes to PostgreSQL via Prisma.

**Account closure tombstones the `User` row — never `user.delete`.** Seven of its eight relations are `onDelete: Cascade`, so a delete takes the organization's prompt chats and API keys with it and orphans the personal organization, whose prompts the mail integration still calls by id. Adding ANY relation to `model User` fails `src/erasure/user-relations.test.ts` until you classify it as erased or retained-with-grounds — that closed world is the point, because the defect this prevents is a relation added later, in an unrelated feature, whose rows then survive every future closure while all tests pass. Values are derived from the row id (never random, never a shared constant: `getUserByAuthID` is a `findFirst` over a non-unique column). Closing an account for real is `AccountClosureService`, not `ErasureService` — the latter is this system only and leaves the identity provider untouched. Its six steps are ordered and the order is load-bearing: **both guards run before anything is written** (or we lock someone out of their identity provider and only then learn a leg refuses), and **deleting the identities is last** because it is the only irreversible step. Mechanism: [docs/account-closure.md](docs/account-closure.md).

### Frontend (`apps/web/src/`)

```
app/
  main.tsx          React entry; sets up QueryClient, Auth0Provider
  App.tsx           ThemeProvider + RouterProvider + Toaster
  router/router.tsx All routes; URL pattern: /:orgId?/:projectId?/...
api/
  client.ts         Axios instance with auth interceptors; injects lab-org-id / lab-proj-id headers
  <domain>/         Typed API functions per domain
hooks/              Custom React hooks (data fetching, UI state)
stores/             Zustand stores (playground, prompt, assertion, audit, modelsSettings)
pages/              Route-level components
components/
  ui/               Radix UI primitives + custom composites
  layout/           MainLayout, sidebar, switchers
lib/
  auth.ts           isCloudAuth() / isLocalAuth() — drives auth mode
  runtime-config.ts Reads window.__RUNTIME_CONFIG__ injected at serve time
```

**Data fetching**: TanStack Query (`@tanstack/react-query`). All server state lives in Query hooks under `src/hooks/`.

**State management**: Zustand stores for complex client state (playground drafts, assertion config, etc.). Use `useShallow` when selecting multiple fields.

**Auth modes**: The frontend switches between Auth0 (`isCloudAuth()`) and cookie-based (`isLocalAuth()`) depending on `runtimeConfig.AUTH_MODE`. The axios client skips the `Authorization` header in local mode.

**Org/project context**: The current `orgId` and `projectId` come from URL params (`:orgId/:projectId`). They're injected into every API request via `lab-org-id` / `lab-proj-id` headers by the axios interceptor. Access them with `getOrgId()` / `getProjectId()` from `api/client.ts`.

**Icons**: Phosphor Icons (`@phosphor-icons/react`) + Lucide React. Prefer Phosphor for new icons.

**UI components**: Radix UI primitives wrapped in `src/components/ui/`. Use existing components before reaching for Radix directly.

## Environment Variables

Single `.env` at repo root. Key variables:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | set in docker-compose | PostgreSQL connection |
| `CLICKHOUSE_URL` | yes | set in docker-compose | ClickHouse HTTP URL |
| `OPENAI_KEY` | no | — | Enables OpenAI |
| `ANTHROPIC_KEY` | no | — | Enables Anthropic |
| `GEMINI_KEY` | no | — | Enables Gemini |
| `DEEPSEEK_KEY` | no | — | Enables DeepSeek |
| `INSTANCE_TYPE` | no | `local` | `local` or `cloud` |
| `AUTH0_*` | cloud only | — | Auth0 config for cloud mode |

Full schema with validation: `apps/core/src/env.ts`.

## Versioning & Releases

Version is tracked in `package.json` (root) and kept in sync with both `apps/*/package.json` and `apps/*/src/constants/VERSION.ts` via `release-it` + `@release-it/bumper`. Run `release-it` from root to cut a release.
