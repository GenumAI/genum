# Genum

<p align="center">
  <img src="https://cdn.genum.ai/images/github_banner.png" alt="Genum GitHub Banner" />
</p>

> An open-source platform to manage, test, and iterate on AI prompts across multiple LLM providers.

<div align="center">

###
<a href="https://genum.ai"><strong>Website</strong></a> ·
<a href="https://docs.genum.ai"><strong>Docs</strong></a> ·
<a href="https://community.genum.ai"><strong>Community</strong></a>

</div>

<!-- TODO: Replace with the official banner/GIFs from https://github.com/GenumAI -->
<!-- ![Genum banner](<banner-url>) -->
<!-- ![Genum demo](<demo-gif-url>) -->

## Concept

Genum centralizes prompt development so teams can create, evaluate, and compare prompts across providers in one place. It ships with a web UI and an API, and stores results in a stack optimized for both transactional data and analytics.

## Architecture

- **Backend API**: `apps/core` (Node.js + Express + TypeScript + Prisma)
- **Frontend Web App**: `apps/web` (React + Vite + TypeScript)
- **Storage Stack**: PostgreSQL + ClickHouse + MinIO (S3-compatible)

## Local Setup (Docker)

### Prerequisites

- **Docker**
- **Docker Compose**
- At least 4GB RAM
- 8GB free disk space

### 1) Clone

```bash
git clone <repo-url>
cd genum
```

### 2) Configure Environment (optional)

Create a **single** `.env` file in the **repo root**. This is the only `.env` used across the project — **do not** create additional `.env` files in subfolders.
For local Docker, **only AI provider keys are required** to enable AI features. Everything else has defaults in `docker-compose*.yml`.

```env
# AI Provider Keys (required only if you want AI features)
OPENAI_KEY=your_openai_key_here
ANTHROPIC_KEY=your_anthropic_key_here
GEMINI_KEY=your_gemini_key_here
```

Tip: start from `env.example` (copy it to `.env`).

### 3) Start

```bash
docker-compose up -d
```

This will:
- Build and start all services
- Run database migrations/seed on the backend
- Launch the web app

### 4) Open

- **Web UI**: `http://localhost:3080`
- **API**: `http://localhost:3010`

## Dependencies (What They Do)

- **PostgreSQL**: Primary transactional database (users, projects, prompts, runs)
- **ClickHouse**: Analytics and fast aggregations over events/results
- **MinIO**: S3-compatible object storage (artifacts, datasets, files)

## Services & Ports

| Service      | Role                  | Default Port                   |
| ------------ | --------------------- | ------------------------------ |
| `core`       | Backend API           | `3010`                         |
| `web`        | Frontend UI           | `3080`                         |
| `postgres`   | Primary DB            | `5432` (localhost only)        |
| `clickhouse` | Analytics DB (HTTP)   | `8123` (localhost only)        |
| `clickhouse` | Analytics DB (native) | `9000` (localhost only)        |
| `minio`      | S3-compatible storage | `9090` (API), `9091` (console) |

## Environment Variables

### Required (Only for AI Features)

- `OPENAI_KEY`: OpenAI API key
- `ANTHROPIC_KEY`: Anthropic API key
- `GEMINI_KEY`: Google API key

You can add any combination of these keys depending on which providers you want to use. Without them, Genum works but AI features are disabled.

## Common Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Logs
docker-compose logs -f

# Rebuild and restart
docker-compose up -d --build

# Remove all data (destructive)
docker-compose down -v
```

## Troubleshooting

### Logs
```

- Review logs
```bash
docker-compose logs
```

### Frontend Can't Reach Backend

- Verify `API_URL` build argument matches your backend URL
- Inspect network: `docker network inspect genum_genum-network`

## Development (No Docker)

For local development without Docker, install deps and run the monorepo dev task.
All apps read from the single root `.env`:

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs dev servers for both `apps/web` and `apps/core` (via Turborepo).
You can also run them separately:

```bash
pnpm dev:web
pnpm dev:core
```

See the app READMEs for details:
- `apps/core/`
- `apps/web/`

## License

Genum is [distributed under the **Business Source License 1.1 (BUSL)**](/LICENSE.md).

### Allowed

- ✔ Personal use
- ✔ Educational use
- ✔ Research and experimentation

### Requires a Commercial License

- ❌ Any commercial use
- ❌ Use inside a business or organization
- ❌ Internal business automation
- ❌ Enterprise deployment
- ❌ Integration into SaaS, services, or commercial tools

Genum is **source-available**, not open-source.
There is **no automatic conversion** to an open-source license.

### FAQ

#### ❓ Can I use genum at home?
Yes. Personal use is fully allowed.

#### ❓ Can I use genum for study or research?
Yes. Educational and research usage is permitted.

#### ❓ Can I modify or fork the code?
Yes, as long as usage remains non-commercial.

#### ❓ Can I use genum inside a company?
No. Any organizational or business usage requires a commercial license.

#### ❓ Can I integrate genum into my SaaS or service?
No — unless you hold a commercial license from rockIT.consulting GmbH.

#### ❓ Is genum open-source?
No. It is **source-available** under BUSL 1.1.

#### ❓ Will genum become open-source?
No. There is no scheduled transition to an open-source license.

#### ❓ How do I obtain a commercial license?
Contact: enterprise@rockit.consulting

## Contributing

Coming soon...
