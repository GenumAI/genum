# Genum Core

Backend API server (Express + TypeScript + Prisma) powering Genum's business logic, AI provider integrations, and persistence layer.

## Run (Recommended)

Use the root Docker flow in `README.md`.

## Local Development (No Docker)

### 1) Install deps (from repo root)

```bash
pnpm install
```

### 2) Start infra (Postgres + ClickHouse + MinIO)

```bash
pnpm dev:infra:up
```

### 3) Configure `.env` (single file in repo root)

Copy `.env.example` to `.env` **in the repo root** and set required values.
There is **only one** `.env` for the entire monorepo — do **not** create per-app `.env` files.

Local `core` dev validates environment variables in `src/env.ts`, so make sure your DB/ClickHouse/S3 URLs are present.

### 4) Start the API

```bash
pnpm --filter core dev
```

Default API URL: `http://localhost:3010`.

## Key Dependencies

- **PostgreSQL**: primary transactional data
- **ClickHouse**: analytics and event storage
- **MinIO (S3)**: object storage for artifacts/files

## Database & Migrations

```bash
pnpm --filter core db:generate
pnpm --filter core dev:db-init
```

## Useful Scripts

```bash
pnpm --filter core lint
pnpm --filter core test
pnpm --filter core test:run
```
