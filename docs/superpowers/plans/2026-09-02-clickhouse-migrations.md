# ClickHouse Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `clickhouse:init` — which cannot create a database that does not exist and reports success when it does nothing — with an ordered, checksummed migration runner that fails loudly.

**Architecture:** A pure core (`split`, `plan`) plus a thin runner that takes an injected ClickHouse client and a migrations directory. Bookkeeping lives in a `_migrations` table in the target database. Lives in `apps/core/src/clickhouse/`, written as if it were a package so a later extraction is a move, not a rewrite.

**Tech Stack:** TypeScript, `@clickhouse/client` (already a core dependency), Vitest, tsx.

**Spec:** `docs/superpowers/specs/2026-09-02-clickhouse-migrations-design.md`

## Global Constraints

- Nothing under `src/clickhouse/` may import `@/env`, `@/database`, or anything from `services/logger` except the client factories. The client and the migrations directory are always arguments.
- Vitest never touches a real database in this repo. Tests cover the pure modules only; the apply path is proven by the documented Docker probe in Task 4.
- Biome: tabs, indent width 4, line width 100. Format every file you touch (`npx biome check --write <paths>`); no pre-commit hook runs.
- Never point anything at the developer's own database. The probe uses a scratch database name the task specifies.
- The checksum is computed on the raw file **before** `{{DB_NAME}}` substitution. This is load-bearing: substituting first gives one migration a different checksum per environment.
- Every migration SQL file must qualify objects with `{{DB_NAME}}`.
- Commit after each task with a message describing what changed and why.

---

### Task 1: The quote-aware statement splitter

**Files:**
- Create: `apps/core/src/clickhouse/split.ts`
- Test: `apps/core/src/clickhouse/split.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `splitStatements(sql: string): string[]`

The existing splitter (`services/logger/init.ts`) cuts on every `;`, which corrupts any statement carrying a semicolon inside a string literal. Fine for today's `CREATE TABLE`, wrong the moment a backfill or a string `DEFAULT` appears.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { splitStatements } from "./split";

describe("splitStatements", () => {
	it("splits on semicolons between statements", () => {
		expect(splitStatements("SELECT 1; SELECT 2;")).toEqual(["SELECT 1", "SELECT 2"]);
	});

	it("keeps a semicolon that lives inside a string literal", () => {
		expect(splitStatements("INSERT INTO t VALUES ('a;b'); SELECT 1")).toEqual([
			"INSERT INTO t VALUES ('a;b')",
			"SELECT 1",
		]);
	});

	it("keeps a double dash that lives inside a string literal", () => {
		expect(splitStatements("SELECT 'a--b'")).toEqual(["SELECT 'a--b'"]);
	});

	it("strips line comments", () => {
		expect(splitStatements("-- a comment\nSELECT 1")).toEqual(["SELECT 1"]);
	});

	it("strips block comments", () => {
		expect(splitStatements("/* a\n comment */ SELECT 1")).toEqual(["SELECT 1"]);
	});

	it("handles a backslash-escaped quote inside a literal", () => {
		expect(splitStatements("SELECT 'it\\'s; fine'")).toEqual(["SELECT 'it\\'s; fine'"]);
	});

	it("keeps a semicolon inside a backtick-quoted identifier", () => {
		expect(splitStatements("SELECT `odd;name` FROM t")).toEqual(["SELECT `odd;name` FROM t"]);
	});

	it("ignores a trailing semicolon and trailing whitespace", () => {
		expect(splitStatements("SELECT 1;\n\n")).toEqual(["SELECT 1"]);
	});

	it("returns nothing for input that is only comments", () => {
		expect(splitStatements("-- nothing here\n/* nor here */\n")).toEqual([]);
	});

	it("returns nothing for empty input", () => {
		expect(splitStatements("")).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/core && pnpm vitest run src/clickhouse/split.test.ts`
Expected: FAIL, cannot resolve `./split`.

- [ ] **Step 3: Implement**

```ts
/**
 * Split a migration file into executable statements.
 *
 * Quote-aware on purpose: the splitter this replaces cut on every `;`, so a semicolon
 * inside a string literal silently truncated the statement around it. Comments are
 * stripped rather than carried, so what reaches the server is the statement alone.
 */
export function splitStatements(sql: string): string[] {
	const statements: string[] = [];
	let current = "";
	let inSingle = false;
	let inBacktick = false;

	for (let i = 0; i < sql.length; i++) {
		const char = sql[i];
		const next = sql[i + 1];

		if (inSingle) {
			current += char;
			if (char === "\\" && next !== undefined) {
				// The escaped character belongs to the literal and can never delimit.
				current += next;
				i++;
			} else if (char === "'") {
				inSingle = false;
			}
			continue;
		}

		if (inBacktick) {
			current += char;
			if (char === "`") inBacktick = false;
			continue;
		}

		if (char === "-" && next === "-") {
			while (i < sql.length && sql[i] !== "\n") i++;
			current += "\n";
			continue;
		}

		if (char === "/" && next === "*") {
			i += 2;
			while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
			i++;
			current += " ";
			continue;
		}

		if (char === "'") {
			inSingle = true;
			current += char;
			continue;
		}

		if (char === "`") {
			inBacktick = true;
			current += char;
			continue;
		}

		if (char === ";") {
			const statement = current.trim();
			if (statement) statements.push(statement);
			current = "";
			continue;
		}

		current += char;
	}

	const trailing = current.trim();
	if (trailing) statements.push(trailing);

	return statements;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/core && pnpm vitest run src/clickhouse/split.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Prove one test can fail**

Temporarily replace the body with `return sql.split(";").map(s => s.trim()).filter(Boolean);`, run the suite, and confirm the two string-literal tests fail. Restore the real implementation and confirm green again. Report both outputs.

- [ ] **Step 6: Format and commit**

```bash
npx biome check --write apps/core/src/clickhouse/split.ts apps/core/src/clickhouse/split.test.ts
git add apps/core/src/clickhouse/split.ts apps/core/src/clickhouse/split.test.ts
git commit -m "feat(clickhouse): quote-aware statement splitter for migration files"
```

---

### Task 2: The migration plan and the checksum

**Files:**
- Create: `apps/core/src/clickhouse/plan.ts`
- Test: `apps/core/src/clickhouse/plan.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type MigrationFile = { name: string; sql: string }`
  - `type AppliedMigration = { name: string; checksum: string }`
  - `type MigrationPlan = { pending: MigrationFile[]; drifted: { name: string; recorded: string; actual: string }[]; missing: string[] }`
  - `migrationChecksum(sql: string): string`
  - `planMigrations(files: MigrationFile[], applied: AppliedMigration[]): MigrationPlan`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { migrationChecksum, planMigrations } from "./plan";

const file = (name: string, sql: string) => ({ name, sql });

describe("migrationChecksum", () => {
	it("is stable for the same content", () => {
		expect(migrationChecksum("SELECT 1")).toBe(migrationChecksum("SELECT 1"));
	});

	it("differs when the content differs", () => {
		expect(migrationChecksum("SELECT 1")).not.toBe(migrationChecksum("SELECT 2"));
	});

	// The whole scheme rests on this: the checksum is taken from the file as written,
	// so one migration has ONE checksum across environments whose database names differ.
	// Checksumming after substitution would make every environment look like drift.
	it("is taken before {{DB_NAME}} substitution", () => {
		const raw = "CREATE TABLE {{DB_NAME}}.logs (a UInt8) ENGINE = Memory";
		expect(migrationChecksum(raw)).not.toBe(migrationChecksum(raw.replace("{{DB_NAME}}", "a")));
	});
});

describe("planMigrations", () => {
	it("reports every file as pending against an empty database", () => {
		const plan = planMigrations([file("002_b.sql", "B"), file("001_a.sql", "A")], []);
		expect(plan.pending.map((f) => f.name)).toEqual(["001_a.sql", "002_b.sql"]);
		expect(plan.drifted).toEqual([]);
		expect(plan.missing).toEqual([]);
	});

	it("orders pending by filename, not by the order they were read", () => {
		const plan = planMigrations(
			[file("20260903_c.sql", "C"), file("20260901_a.sql", "A"), file("20260902_b.sql", "B")],
			[],
		);
		expect(plan.pending.map((f) => f.name)).toEqual([
			"20260901_a.sql",
			"20260902_b.sql",
			"20260903_c.sql",
		]);
	});

	it("leaves an already applied migration out of pending", () => {
		const applied = [{ name: "001_a.sql", checksum: migrationChecksum("A") }];
		const plan = planMigrations([file("001_a.sql", "A"), file("002_b.sql", "B")], applied);
		expect(plan.pending.map((f) => f.name)).toEqual(["002_b.sql"]);
		expect(plan.drifted).toEqual([]);
	});

	it("reports an edited applied migration as drift, and never as pending", () => {
		const applied = [{ name: "001_a.sql", checksum: migrationChecksum("A") }];
		const plan = planMigrations([file("001_a.sql", "A EDITED")], applied);
		expect(plan.pending).toEqual([]);
		expect(plan.drifted).toEqual([
			{
				name: "001_a.sql",
				recorded: migrationChecksum("A"),
				actual: migrationChecksum("A EDITED"),
			},
		]);
	});

	it("reports an applied migration whose file is gone as missing", () => {
		const applied = [
			{ name: "001_a.sql", checksum: migrationChecksum("A") },
			{ name: "000_gone.sql", checksum: "whatever" },
		];
		const plan = planMigrations([file("001_a.sql", "A")], applied);
		expect(plan.missing).toEqual(["000_gone.sql"]);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/core && pnpm vitest run src/clickhouse/plan.test.ts`
Expected: FAIL, cannot resolve `./plan`.

- [ ] **Step 3: Implement**

```ts
import { createHash } from "node:crypto";

export type MigrationFile = { name: string; sql: string };
export type AppliedMigration = { name: string; checksum: string };

export type MigrationPlan = {
	pending: MigrationFile[];
	drifted: { name: string; recorded: string; actual: string }[];
	missing: string[];
};

/**
 * sha256 of the migration as written on disk, BEFORE `{{DB_NAME}}` substitution.
 *
 * Substituting first would give one migration a different checksum in every environment
 * whose database is named differently, and each of them would then read as drift.
 */
export function migrationChecksum(sql: string): string {
	return createHash("sha256").update(sql, "utf8").digest("hex");
}

/**
 * Decide what to apply, refuse, or complain about -- without touching a database.
 *
 * A file that drifted is never also pending: re-running an edited migration is exactly
 * what the checksum exists to prevent. Both drift and missing are computed over the whole
 * set so the caller can refuse before executing a single statement.
 */
export function planMigrations(
	files: MigrationFile[],
	applied: AppliedMigration[],
): MigrationPlan {
	const recordedByName = new Map(applied.map((row) => [row.name, row.checksum]));
	const namesOnDisk = new Set(files.map((file) => file.name));

	const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name));

	const pending: MigrationFile[] = [];
	const drifted: MigrationPlan["drifted"] = [];

	for (const file of ordered) {
		const recorded = recordedByName.get(file.name);
		if (recorded === undefined) {
			pending.push(file);
			continue;
		}
		const actual = migrationChecksum(file.sql);
		if (recorded !== actual) {
			drifted.push({ name: file.name, recorded, actual });
		}
	}

	const missing = applied
		.map((row) => row.name)
		.filter((name) => !namesOnDisk.has(name))
		.sort();

	return { pending, drifted, missing };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/core && pnpm vitest run src/clickhouse/plan.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Prove the drift test can fail**

Temporarily make `planMigrations` skip the checksum comparison (treat a recorded name as clean), run the suite, confirm the drift test fails. Restore and confirm green. Report both outputs.

- [ ] **Step 6: Format and commit**

```bash
npx biome check --write apps/core/src/clickhouse/plan.ts apps/core/src/clickhouse/plan.test.ts
git add apps/core/src/clickhouse/plan.ts apps/core/src/clickhouse/plan.test.ts
git commit -m "feat(clickhouse): migration plan with drift detection by checksum"
```

---

### Task 3: The runner

**Files:**
- Create: `apps/core/src/clickhouse/migrate.ts`
- Modify: `apps/core/src/services/logger/logger.ts` (add an admin client factory next to `clickhouseClient`, around line 86)

**Interfaces:**
- Consumes: `splitStatements` from `./split`; `planMigrations`, `migrationChecksum`, `MigrationFile`, `AppliedMigration`, `MigrationPlan` from `./plan`.
- Produces:
  - `createAdminClickhouseClient(): ClickHouseClient` (from `logger.ts`)
  - `MIGRATIONS_TABLE = "_migrations"`
  - `assertSafeDatabaseName(database: string): void`
  - `readMigrationFiles(dir: string): Promise<MigrationFile[]>`
  - `ensureDatabase(admin: ClickHouseClient, database: string): Promise<void>`
  - `readAppliedMigrations(client: ClickHouseClient, database: string): Promise<AppliedMigration[]>`
  - `buildPlan(dir: string, client: ClickHouseClient, database: string): Promise<MigrationPlan>`
  - `applyPending(client: ClickHouseClient, database: string, plan: MigrationPlan): Promise<string[]>`
  - `class MigrationError extends Error`

- [ ] **Step 1: Add the admin client factory to `logger.ts`**

Insert directly after the existing `clickhouseClient` export:

```ts
/**
 * A client bound to NO database, for the one statement that cannot assume one exists:
 * CREATE DATABASE.
 *
 * `clickhouseClient` above sends its session database with every request, so using it to
 * bootstrap answers `Database <name> does not exist.` -- and the init script this
 * replaces classified that message as benign, which is how a fresh environment came to be
 * "initialised successfully" into nothing.
 */
export function createAdminClickhouseClient() {
	return createClient({
		url: clickhouseUrl,
		username: clickhouseUsername,
		password: clickhousePassword,
	});
}
```

- [ ] **Step 2: Implement the runner**

```ts
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClickHouseClient } from "@clickhouse/client";
import { splitStatements } from "./split";
import {
	type AppliedMigration,
	type MigrationFile,
	type MigrationPlan,
	migrationChecksum,
	planMigrations,
} from "./plan";

export const MIGRATIONS_TABLE = "_migrations";

export class MigrationError extends Error {}

/**
 * The database name is interpolated into DDL that cannot be parameterised, so it is
 * validated rather than escaped -- same rule the previous init script applied.
 */
export function assertSafeDatabaseName(database: string): void {
	if (!/^[A-Za-z0-9_]+$/.test(database)) {
		throw new MigrationError(`Invalid ClickHouse database name: ${database}`);
	}
}

export async function readMigrationFiles(dir: string): Promise<MigrationFile[]> {
	const entries = await readdir(dir);
	const names = entries.filter((name) => name.endsWith(".sql")).sort();

	const files: MigrationFile[] = [];
	for (const name of names) {
		files.push({ name, sql: await readFile(join(dir, name), "utf-8") });
	}
	return files;
}

export async function ensureDatabase(admin: ClickHouseClient, database: string): Promise<void> {
	assertSafeDatabaseName(database);
	await admin.command({ query: `CREATE DATABASE IF NOT EXISTS ${database}` });
	// ReplacingMergeTree because ClickHouse enforces no uniqueness on insert: a retry or
	// two runners racing must not leave two rows that both count. Reads use FINAL.
	await admin.command({
		query: `CREATE TABLE IF NOT EXISTS ${database}.${MIGRATIONS_TABLE}
			(
				name         String,
				checksum     String,
				applied_at   DateTime64(3) DEFAULT now64(),
				execution_ms UInt32
			)
			ENGINE = ReplacingMergeTree(applied_at)
			ORDER BY name`,
	});
}

export async function readAppliedMigrations(
	client: ClickHouseClient,
	database: string,
): Promise<AppliedMigration[]> {
	const resultSet = await client.query({
		query: `SELECT name, checksum FROM ${database}.${MIGRATIONS_TABLE} FINAL ORDER BY name`,
		format: "JSONEachRow",
	});
	return await resultSet.json<AppliedMigration>();
}

export async function buildPlan(
	dir: string,
	client: ClickHouseClient,
	database: string,
): Promise<MigrationPlan> {
	const files = await readMigrationFiles(dir);
	const applied = await readAppliedMigrations(client, database);
	return planMigrations(files, applied);
}

/**
 * Applies `plan.pending` in order and returns the names applied.
 *
 * Stops at the first failing statement and throws: ClickHouse has no transactional DDL,
 * so continuing past a failure would leave the schema in a state nobody described. The
 * failed migration is deliberately NOT recorded, so the next run retries it.
 */
export async function applyPending(
	client: ClickHouseClient,
	database: string,
	plan: MigrationPlan,
): Promise<string[]> {
	assertSafeDatabaseName(database);

	if (plan.drifted.length > 0 || plan.missing.length > 0) {
		throw new MigrationError(
			"Refusing to migrate: the recorded history and the files on disk disagree.",
		);
	}

	const applied: string[] = [];

	for (const file of plan.pending) {
		const sql = file.sql.replace(/{{DB_NAME}}/g, database);
		const statements = splitStatements(sql);
		const startedAt = Date.now();

		for (const [index, statement] of statements.entries()) {
			try {
				await client.command({ query: statement });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new MigrationError(
					`${file.name} failed at statement ${index + 1} of ${statements.length}:\n` +
						`${statement.slice(0, 300)}\n\nClickHouse said: ${message}`,
				);
			}
		}

		await client.insert({
			table: `${database}.${MIGRATIONS_TABLE}`,
			values: [
				{
					name: file.name,
					checksum: migrationChecksum(file.sql),
					execution_ms: Date.now() - startedAt,
				},
			],
			format: "JSONEachRow",
		});

		applied.push(file.name);
	}

	return applied;
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter core type-check`
Expected: clean. If `resultSet.json<AppliedMigration>()` does not type-check against the installed `@clickhouse/client` version, adapt to that version's signature and say in your report exactly what you changed and why — do not cast to `any`.

- [ ] **Step 4: Run the whole core suite**

Run: `cd apps/core && pnpm vitest run`
Expected: all green, no new failures. (The runner itself is proven in Task 4 against a real server; it has no unit tests by design — the pure logic it composes is already covered.)

- [ ] **Step 5: Format and commit**

```bash
npx biome check --write apps/core/src/clickhouse/migrate.ts apps/core/src/services/logger/logger.ts
git add apps/core/src/clickhouse/migrate.ts apps/core/src/services/logger/logger.ts
git commit -m "feat(clickhouse): migration runner with a database-less bootstrap client"
```

---

### Task 4: Wire it up, delete the old path, and prove it against a real server

**Files:**
- Create: `apps/core/src/clickhouse/cli/migrate.ts`
- Create: `apps/core/src/clickhouse/cli/status.ts`
- Create: `apps/core/clickhouse/migrations/20260902000000_init.sql` (content moved verbatim from `apps/core/clickhouse/init.sql`)
- Create: `apps/core/clickhouse/migrations/README.md`
- Modify: `apps/core/package.json` (scripts)
- Delete: `apps/core/src/services/logger/init.ts`, `apps/core/src/services/logger/init-clickhouse.ts`, `apps/core/clickhouse/init.sql`

**Interfaces:**
- Consumes: everything from Task 3.
- Produces: the `clickhouse:migrate:*` and `clickhouse:status:*` scripts.

**Note on the migrations directory path:** `src/clickhouse/cli/` compiles to `dist/clickhouse/cli/`, so `join(__dirname, "../../../clickhouse/migrations")` resolves to `apps/core/clickhouse/migrations` from **both** the source tree (under tsx) and `dist` (under node). One path, no candidate list — the three-candidate search in the old `init.ts` existed only because its source and compiled depths differed. Verify this claim in both modes rather than trusting it.

- [ ] **Step 1: Move the schema into the first migration**

```bash
mkdir -p apps/core/clickhouse/migrations
git mv apps/core/clickhouse/init.sql apps/core/clickhouse/migrations/20260902000000_init.sql
```

Do not edit the content. It is idempotent, so it re-applies as a no-op on existing installations and is simply recorded — which is why no baseline step is needed.

- [ ] **Step 2: Write the migrations README**

```markdown
# ClickHouse migrations

Applied in filename order by `pnpm clickhouse:migrate:dev` (or `:prod`). Never edit an
applied file — the runner records a checksum and will refuse to run. Add a new one.

- Name: `<UTC timestamp>_<slug>.sql`, e.g. `20260915103000_drop_memory_key.sql`.
- **Qualify every object with `{{DB_NAME}}`.** It is substituted at runtime. An
  unqualified `CREATE TABLE logs` lands in whatever the session database happens to be.
- **One file, one logical change.** ClickHouse has no transactional DDL, so a file that
  fails halfway leaves its earlier statements applied.
- `pnpm clickhouse:status:dev` prints applied, pending and drifted, and exits non-zero on
  drift.
```

- [ ] **Step 3: Write the two entry points**

`apps/core/src/clickhouse/cli/migrate.ts`:

```ts
import "dotenv/config";
import { join } from "node:path";
import { env } from "@/env";
import { clickhouseClient, createAdminClickhouseClient } from "@/services/logger/logger";
import { applyPending, buildPlan, ensureDatabase, MigrationError } from "../migrate";

const MIGRATIONS_DIR = join(__dirname, "../../../clickhouse/migrations");

async function main() {
	const database = env.CLICKHOUSE_DB;
	const admin = createAdminClickhouseClient();

	try {
		await ensureDatabase(admin, database);
	} finally {
		await admin.close();
	}

	const plan = await buildPlan(MIGRATIONS_DIR, clickhouseClient, database);

	if (plan.drifted.length > 0) {
		for (const entry of plan.drifted) {
			console.error(
				`DRIFT ${entry.name}: applied as ${entry.recorded.slice(0, 12)}, ` +
					`file is now ${entry.actual.slice(0, 12)}`,
			);
		}
		console.error("An applied migration was edited. Add a new migration instead.");
		process.exit(1);
	}

	if (plan.missing.length > 0) {
		for (const name of plan.missing) console.error(`MISSING ${name}: applied, but no file`);
		console.error("Recorded history has no file on disk. This needs a human.");
		process.exit(1);
	}

	if (plan.pending.length === 0) {
		console.log(`ClickHouse schema is up to date (database: ${database}).`);
		return;
	}

	const applied = await applyPending(clickhouseClient, database, plan);
	for (const name of applied) console.log(`applied ${name}`);
	console.log(`Applied ${applied.length} migration(s) to ${database}.`);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		// Loud on purpose. The script this replaces swallowed every statement error and
		// exited 0, so a fresh environment silently got no schema at all.
		console.error(
			error instanceof MigrationError
				? `ClickHouse migration failed:\n${error.message}`
				: error,
		);
		process.exit(1);
	});
```

`apps/core/src/clickhouse/cli/status.ts`:

```ts
import "dotenv/config";
import { join } from "node:path";
import { env } from "@/env";
import { clickhouseClient, createAdminClickhouseClient } from "@/services/logger/logger";
import { buildPlan, ensureDatabase } from "../migrate";

const MIGRATIONS_DIR = join(__dirname, "../../../clickhouse/migrations");

async function main(): Promise<number> {
	const database = env.CLICKHOUSE_DB;
	const admin = createAdminClickhouseClient();

	try {
		await ensureDatabase(admin, database);
	} finally {
		await admin.close();
	}

	const plan = await buildPlan(MIGRATIONS_DIR, clickhouseClient, database);

	console.log(`database: ${database}`);
	console.log(`pending:  ${plan.pending.length}`);
	for (const file of plan.pending) console.log(`  - ${file.name}`);
	console.log(`drifted:  ${plan.drifted.length}`);
	for (const entry of plan.drifted) console.log(`  - ${entry.name}`);
	console.log(`missing:  ${plan.missing.length}`);
	for (const name of plan.missing) console.log(`  - ${name}`);

	return plan.drifted.length > 0 || plan.missing.length > 0 ? 1 : 0;
}

main()
	.then((code) => process.exit(code))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
```

- [ ] **Step 4: Update the scripts**

In `apps/core/package.json`, replace the two `clickhouse:init:*` entries with:

```json
"clickhouse:migrate:dev": "dotenv -e ../../.env tsx src/clickhouse/cli/migrate.ts",
"clickhouse:migrate:prod": "node dist/clickhouse/cli/migrate.js",
"clickhouse:status:dev": "dotenv -e ../../.env tsx src/clickhouse/cli/status.ts",
"clickhouse:status:prod": "node dist/clickhouse/cli/status.js",
```

and update the two callers:
- `dev:db-init`: `clickhouse:init:dev` → `clickhouse:migrate:dev`
- `db-init`: `clickhouse:init:prod` → `clickhouse:migrate:prod`

- [ ] **Step 5: Delete the old path**

```bash
git rm apps/core/src/services/logger/init.ts apps/core/src/services/logger/init-clickhouse.ts
```

Then grep for any remaining reference and fix it:

```bash
grep -rn "initializeClickHouse\|init-clickhouse\|clickhouse:init" --include="*.ts" --include="*.json" --include="*.sh" --include="*.yml" . | grep -v node_modules
```

Expected after the change: no hits outside this plan and the spec.

- [ ] **Step 6: Type-check and build**

```bash
pnpm --filter core type-check
pnpm --filter core build
```

Both clean. Then confirm the compiled entry point exists at `apps/core/dist/clickhouse/cli/migrate.js`.

- [ ] **Step 7: Prove it against a real ClickHouse**

A container is already running as `genum-clickhouse` (`docker ps`). Use the scratch database name `ch_migrate_probe` throughout — **never** the value in `.env`, and never `default`.

Run each of these from `apps/core` and paste the real output into your report:

1. **Fresh database.** `CLICKHOUSE_DB=ch_migrate_probe npx dotenv -e ../../.env -- npx tsx src/clickhouse/cli/migrate.ts`
   Expected: `applied 20260902000000_init.sql`, exit 0. Then confirm with
   `docker exec genum-clickhouse clickhouse-client --query "SELECT name FROM system.tables WHERE database='ch_migrate_probe' FORMAT TSV"`
   that both `logs` and `_migrations` exist, and that `logs` has the `placeholders` column.

2. **Second run is a no-op.** Same command again. Expected: `ClickHouse schema is up to date`, exit 0, and `_migrations` still has exactly one row.

3. **Positive control — a failing migration must fail the process.** Create `apps/core/clickhouse/migrations/29990101000000_probe_fail.sql` containing `THIS IS NOT SQL;`, run migrate, and confirm: non-zero exit, the server's message printed, and `SELECT count() FROM ch_migrate_probe._migrations FINAL` still 1 — the failed migration was not recorded. **Delete the file afterwards.** Without this control, "the run succeeded" proves nothing, which is the exact defect this whole change exists to remove.

4. **Drift is refused.** Append a trailing comment line to `20260902000000_init.sql`, run migrate, confirm a `DRIFT` line and a non-zero exit. **Revert the edit** (`git checkout -- apps/core/clickhouse/migrations/20260902000000_init.sql`) and confirm migrate is clean again.

5. **Compiled mode resolves the same directory.** `CLICKHOUSE_DB=ch_migrate_probe npx dotenv -e ../../.env -- node dist/clickhouse/cli/migrate.js` → `up to date`, exit 0. This is the claim in the note above; verify it rather than assume it.

6. **Status.** `CLICKHOUSE_DB=ch_migrate_probe npx dotenv -e ../../.env -- npx tsx src/clickhouse/cli/status.ts` → 1 applied, 0 pending, 0 drifted, exit 0.

Finally, drop the scratch database:
`docker exec genum-clickhouse clickhouse-client --query "DROP DATABASE IF EXISTS ch_migrate_probe"`

- [ ] **Step 8: Format and commit**

```bash
npx biome check --write apps/core/src/clickhouse/cli/migrate.ts apps/core/src/clickhouse/cli/status.ts apps/core/package.json
git add -A
git commit -m "feat(clickhouse): replace init with a migration runner, and delete the swallowing path"
```

---

## Self-review notes

- Spec coverage: goals 1-4 map to Task 3 (bootstrap + loud failure), Task 4 step 7 (evidence), the migrations directory (non-idempotent changes become possible), and Task 2 (drift).
- Type consistency: `MigrationFile`, `AppliedMigration` and `MigrationPlan` are defined once in Task 2 and consumed by name in Task 3; `splitStatements` is defined in Task 1 and consumed in Task 3.
- The runner has no unit tests on purpose — everything testable without a server is in `split.ts` and `plan.ts`, and the rest is proven by Task 4's probe. A reviewer who wants unit tests for `applyPending` should read that as a request to mock the client, which would test the mock.
