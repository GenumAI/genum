# Genum Web

Frontend React app (Vite + TypeScript) for the Genum UI.

## Run (Recommended)

Use the root Docker flow in `README.md`.

## Local Development (No Docker)

### 1) Install deps (from repo root)

```bash
pnpm install
```

### 2) Start the web app

```bash
pnpm --filter web dev
```

### 3) Ensure the API is reachable

Default API URL: `http://localhost:3010`.

## Runtime Config

The app supports two config sources (see `src/lib/runtime-config.ts`).
Local development reads from the **single root** `.env` (via Vite `VITE_*`), not per-app files.

- `window.__ENV__` via `/env.js` (Docker/Nginx runtime injection)
- `import.meta.env.VITE_*` (Vite build-time fallback for dev)

Key config values:

- `API_URL` or `VITE_API_URL`
- `AUTH_MODE` or `VITE_AUTH_MODE`
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE`
- `SENTRY_ENABLED`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`
- `GA_TRACKING_ID`

## Useful Scripts

```bash
pnpm --filter web build
pnpm --filter web preview
pnpm --filter web lint
```
