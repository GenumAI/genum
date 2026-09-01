# Prompt Placeholders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace prompt `Memory` with named, versioned, enumerated placeholders — `{{admin_role}}` holes in the prompt text whose blocks are chosen per run, committed with the prompt, recorded on every run and pinned by testcases.

**Architecture:** A dependency-free workspace package owns the syntax (detect + render) so the frontend chips and the backend runtime cannot disagree. Postgres holds `Placeholder` → `PlaceholderValue`, a join table pins a testcase's selection, and `PromptVersion.placeholders` stores the committed snapshot that a `productive: true` run reads together with its text. ClickHouse gains a `placeholders` map; the legacy `memory_key` column stays readable and is never written again.

**Tech Stack:** TypeScript, Node + Express, Prisma + PostgreSQL, ClickHouse, Vitest, React + Vite, TanStack Query, Zustand, Radix UI, pnpm workspaces + Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-01-prompt-placeholders-design.md`

## Global Constraints

- Formatting: Biome — **tabs**, indent width 4, line width 100, LF. Format the files you touch; no pre-commit hook runs.
- Lint/format are already red on `main` (core 35 problems, web 354, biome 172). Judge your change by its delta on files you touched, never by exit code.
- No test may require a database. `pnpm --filter core test:run` runs without Postgres or ClickHouse; keep it that way by testing pure functions and mocking `db`.
- After any change to `apps/core/prisma/**`, run `pnpm prisma:generate` before type-checking, or enum/model types come back stale and the errors will not match your code.
- Prisma migrations: one logical change per migration; never edit a migration that has been applied.
- `apps/web` has no test runner. Its verification is `pnpm --filter web build` (which runs `tsc -b`) plus the manual check written in the task.
- Placeholder key syntax is exactly `{{key}}` where key matches `[a-zA-Z0-9_]+`. It is defined once, in `packages/placeholders`, and imported everywhere else.
- Every new user-facing string in the UI is English.

---

### Task 1: The shared `@genum/placeholders` package

The syntax, the detector and the renderer, with no dependencies, so `apps/core` and `apps/web` share one implementation. `apps/web` does not depend on `apps/core`, and a copy of the regex in the frontend is what would let the chips promise something the runtime does not do.

**Files:**
- Create: `packages/placeholders/package.json`
- Create: `packages/placeholders/tsconfig.json`
- Create: `packages/placeholders/tsconfig.build.json`
- Create: `packages/placeholders/vitest.config.ts`
- Create: `packages/placeholders/src/index.ts`
- Create: `packages/placeholders/src/types.ts`
- Create: `packages/placeholders/src/detect.ts`
- Create: `packages/placeholders/src/render.ts`
- Test: `packages/placeholders/src/detect.test.ts`
- Test: `packages/placeholders/src/render.test.ts`
- Modify: `turbo.json` (the `dev` task)
- Modify: `apps/core/package.json` (dependencies)
- Modify: `apps/web/package.json` (dependencies)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type PlaceholderValueDefinition = { name: string; content: string; isDefault: boolean }`
  - `type PlaceholderDefinition = { key: string; values: PlaceholderValueDefinition[] }`
  - `type PlaceholderSelection = Record<string, string>`
  - `type RenderResult = { text: string; resolved: Record<string, string | null>; ignored: string[]; undefinedKeys: string[] }`
  - `detectPlaceholderKeys(text: string): string[]`
  - `renderPlaceholders(text: string, definitions: PlaceholderDefinition[], selection: PlaceholderSelection): RenderResult`
  - `PLACEHOLDER_KEY_PATTERN: RegExp`

- [ ] **Step 1: Create the package manifest and TS config**

`packages/placeholders/package.json`:

```json
{
	"name": "@genum/placeholders",
	"version": "0.0.0",
	"private": true,
	"main": "./dist/index.js",
	"types": "./dist/index.d.ts",
	"scripts": {
		"build": "tsc -p tsconfig.build.json",
		"type-check": "tsc --noEmit",
		"test": "vitest",
		"test:run": "vitest run"
	},
	"devDependencies": {
		"typescript": "^5.7.3",
		"vitest": "^3.0.5"
	}
}
```

`packages/placeholders/tsconfig.json`:

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "CommonJS",
		"moduleResolution": "node",
		"declaration": true,
		"strict": true,
		"esModuleInterop": true,
		"skipLibCheck": true,
		"forceConsistentCasingInFileNames": true,
		"outDir": "dist",
		"rootDir": "src"
	},
	"include": ["src/**/*"]
}
```

`packages/placeholders/tsconfig.build.json`:

```json
{
	"extends": "./tsconfig.json",
	"exclude": ["src/**/*.test.ts"]
}
```

`packages/placeholders/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.{test,spec}.ts"],
	},
});
```

- [ ] **Step 2: Write the failing detector test**

`packages/placeholders/src/detect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectPlaceholderKeys } from "./detect";

describe("detectPlaceholderKeys", () => {
	it("finds every key in order of first appearance", () => {
		expect(detectPlaceholderKeys("a {{one}} b {{two}} c")).toEqual(["one", "two"]);
	});

	it("de-duplicates a key used more than once", () => {
		expect(detectPlaceholderKeys("{{k}} and again {{k}}")).toEqual(["k"]);
	});

	it("returns an empty array when there is nothing to find", () => {
		expect(detectPlaceholderKeys("plain text")).toEqual([]);
	});

	it("ignores malformed markers", () => {
		// Single braces, spaces inside, and characters outside [a-zA-Z0-9_] are not keys.
		expect(detectPlaceholderKeys("{one} {{ two }} {{th-ree}} {{}}")).toEqual([]);
	});
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm --filter @genum/placeholders test:run src/detect.test.ts`
Expected: FAIL — cannot resolve `./detect`.

- [ ] **Step 4: Implement the detector**

`packages/placeholders/src/detect.ts`:

```ts
/**
 * The one definition of the placeholder syntax. Everything that reads or writes a
 * `{{key}}` — the runtime, the playground chips, the Placeholders tab — goes through
 * this module, so the UI cannot promise a substitution the runtime will not perform.
 *
 * The `g` flag makes the regex stateful, so callers must never share this instance:
 * `detectPlaceholderKeys` and `renderPlaceholders` each build their own from `.source`.
 */
export const PLACEHOLDER_KEY_PATTERN = /\{\{([a-zA-Z0-9_]+)\}\}/g;

export function detectPlaceholderKeys(text: string): string[] {
	const pattern = new RegExp(PLACEHOLDER_KEY_PATTERN.source, "g");
	const seen = new Set<string>();
	const keys: string[] = [];

	let match = pattern.exec(text);
	while (match !== null) {
		const key = match[1];
		if (!seen.has(key)) {
			seen.add(key);
			keys.push(key);
		}
		match = pattern.exec(text);
	}

	return keys;
}
```

- [ ] **Step 5: Run the detector test**

Run: `pnpm --filter @genum/placeholders test:run src/detect.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Write the failing renderer test**

`packages/placeholders/src/render.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderPlaceholders } from "./render";
import type { PlaceholderDefinition } from "./types";

const adminRole: PlaceholderDefinition = {
	key: "admin_role",
	values: [
		{ name: "false", content: "", isDefault: true },
		{ name: "true", content: "You may use the tag tools.", isDefault: false },
	],
};

describe("renderPlaceholders", () => {
	it("substitutes the selected value", () => {
		const result = renderPlaceholders("A {{admin_role}} B", [adminRole], {
			admin_role: "true",
		});

		expect(result.text).toBe("A You may use the tag tools. B");
		expect(result.resolved).toEqual({ admin_role: "true" });
	});

	it("replaces every occurrence, not just the first", () => {
		const result = renderPlaceholders("{{admin_role}}|{{admin_role}}", [adminRole], {
			admin_role: "true",
		});

		expect(result.text).toBe("You may use the tag tools.|You may use the tag tools.");
	});

	it("falls back to the default value when nothing is selected", () => {
		const result = renderPlaceholders("A {{admin_role}} B", [adminRole], {});

		expect(result.text).toBe("A  B");
		expect(result.resolved).toEqual({ admin_role: "false" });
	});

	it("renders nothing and resolves to null when there is no default", () => {
		const noDefault: PlaceholderDefinition = {
			key: "memory_key",
			values: [{ name: "client_bmw", content: "BMW refs start with WB.", isDefault: false }],
		};

		const result = renderPlaceholders("A {{memory_key}} B", [noDefault], {});

		expect(result.text).toBe("A  B");
		expect(result.resolved).toEqual({ memory_key: null });
	});

	it("ignores a selected value whose key is not in the text", () => {
		const result = renderPlaceholders("no holes here", [adminRole], { admin_role: "true" });

		expect(result.text).toBe("no holes here");
		expect(result.ignored).toEqual(["admin_role"]);
		expect(result.resolved).toEqual({});
	});

	it("ignores a selected value naming a value that does not exist", () => {
		// An unknown name must not silently behave like the default: it is caller error.
		const result = renderPlaceholders("A {{admin_role}} B", [adminRole], {
			admin_role: "maybe",
		});

		expect(result.text).toBe("A  B");
		expect(result.resolved).toEqual({ admin_role: "false" });
		expect(result.ignored).toEqual(["admin_role"]);
	});

	it("leaves an undefined key verbatim and reports it", () => {
		const result = renderPlaceholders("A {{tone}} B", [adminRole], {});

		expect(result.text).toBe("A {{tone}} B");
		expect(result.undefinedKeys).toEqual(["tone"]);
	});

	it("reproduces the old memory behaviour when the key sits at the end", () => {
		// The migration appends `\n\n{{memory_key}}` to the draft, and this is the
		// proof that doing so is faithful to `instruction += memory.value`.
		const instruction = "# Role\nYou extract orders.";
		const memoryValue = "BMW refs start with WB.";
		const definitions: PlaceholderDefinition[] = [
			{
				key: "memory_key",
				values: [{ name: "client_bmw", content: memoryValue, isDefault: false }],
			},
		];

		const result = renderPlaceholders(`${instruction}\n\n{{memory_key}}`, definitions, {
			memory_key: "client_bmw",
		});

		expect(result.text).toBe(`${instruction}\n\n${memoryValue}`);
	});
});
```

- [ ] **Step 7: Run it and confirm it fails**

Run: `pnpm --filter @genum/placeholders test:run src/render.test.ts`
Expected: FAIL — cannot resolve `./render`.

- [ ] **Step 8: Implement the types and the renderer**

`packages/placeholders/src/types.ts`:

```ts
export type PlaceholderValueDefinition = {
	name: string;
	content: string;
	isDefault: boolean;
};

export type PlaceholderDefinition = {
	key: string;
	values: PlaceholderValueDefinition[];
};

/** key -> the NAME of the chosen value. Never block text: the text lives in Lab. */
export type PlaceholderSelection = Record<string, string>;

export type RenderResult = {
	text: string;
	/** Only keys that occur in the text. `null` means nothing resolved (no selection, no default). */
	resolved: Record<string, string | null>;
	/** Selected keys with no `{{key}}` in the text, or naming a value that does not exist. */
	ignored: string[];
	/** `{{key}}` occurrences with no definition. Left in the text verbatim. */
	undefinedKeys: string[];
};
```

`packages/placeholders/src/render.ts`:

```ts
import { detectPlaceholderKeys, PLACEHOLDER_KEY_PATTERN } from "./detect";
import type { PlaceholderDefinition, PlaceholderSelection, RenderResult } from "./types";

export function renderPlaceholders(
	text: string,
	definitions: PlaceholderDefinition[],
	selection: PlaceholderSelection,
): RenderResult {
	const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
	const keysInText = detectPlaceholderKeys(text);
	const keysInTextSet = new Set(keysInText);

	const resolved: Record<string, string | null> = {};
	const ignored: string[] = [];
	const undefinedKeys: string[] = [];
	const content = new Map<string, string>();

	for (const key of keysInText) {
		const definition = byKey.get(key);
		if (!definition) {
			undefinedKeys.push(key);
			continue;
		}

		const requested = selection[key];
		const chosen =
			requested === undefined
				? undefined
				: definition.values.find((value) => value.name === requested);

		// A name that does not exist is caller error, not a request for the default.
		// It still falls back, so the run works, but it is reported rather than hidden.
		if (requested !== undefined && !chosen) {
			ignored.push(key);
		}

		const effective = chosen ?? definition.values.find((value) => value.isDefault);
		resolved[key] = effective ? effective.name : null;
		content.set(key, effective ? effective.content : "");
	}

	// A selection for a key that is not a hole in this text is dropped — decision 5 in
	// the spec — and reported, because silently discarding it turns a caller's typo
	// into a model-quality complaint.
	for (const key of Object.keys(selection)) {
		if (!keysInTextSet.has(key) && !ignored.includes(key)) {
			ignored.push(key);
		}
	}

	const pattern = new RegExp(PLACEHOLDER_KEY_PATTERN.source, "g");
	const rendered = text.replace(pattern, (match, key: string) =>
		content.has(key) ? (content.get(key) as string) : match,
	);

	return { text: rendered, resolved, ignored, undefinedKeys };
}
```

`packages/placeholders/src/index.ts`:

```ts
export { detectPlaceholderKeys, PLACEHOLDER_KEY_PATTERN } from "./detect";
export { renderPlaceholders } from "./render";
export type {
	PlaceholderDefinition,
	PlaceholderSelection,
	PlaceholderValueDefinition,
	RenderResult,
} from "./types";
```

- [ ] **Step 9: Run the whole package test suite**

Run: `pnpm --filter @genum/placeholders test:run`
Expected: PASS, 12 tests across two files.

- [ ] **Step 10: Wire the package into both apps and into turbo**

Add to the `dependencies` of `apps/core/package.json` and `apps/web/package.json`:

```json
"@genum/placeholders": "workspace:*"
```

In `turbo.json`, the `dev` task must build workspace dependencies first, or `tsx watch` starts before `dist` exists:

```json
"dev": {
	"cache": false,
	"persistent": true,
	"dependsOn": ["^build", "dev:db-init"]
},
```

Then:

```bash
pnpm install
pnpm --filter @genum/placeholders build
```

- [ ] **Step 11: Verify both apps still build**

Run: `pnpm --filter core type-check && pnpm --filter web build`
Expected: core type-check produces no new errors; web build succeeds.

- [ ] **Step 12: Commit**

```bash
git add packages/placeholders turbo.json apps/core/package.json apps/web/package.json pnpm-lock.yaml
git commit -m "feat(placeholders): add the shared placeholder syntax package"
```

---

### Task 2: Prisma schema — the three models and the commit snapshot column

Additive only. `Memory` stays until Task 11, so the tree keeps compiling and every later task has something to build against.

**Files:**
- Create: `apps/core/prisma/models/placeholder.prisma`
- Modify: `apps/core/prisma/models/prompt.prisma` (add relations to `Prompt` and `PromptVersion`)
- Modify: `apps/core/prisma/models/testcase.prisma` (add the back-relation)
- Create: `apps/core/prisma/migrations/<timestamp>_add_prompt_placeholders/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma models `Placeholder`, `PlaceholderValue`, `TestCasePlaceholderValue`; `PromptVersion.placeholders Json?`; `Prompt.placeholders Placeholder[]`; `TestCase.placeholderValues TestCasePlaceholderValue[]`.

- [ ] **Step 1: Write the models**

`apps/core/prisma/models/placeholder.prisma`:

```prisma
model Placeholder {
    id          Int     @id @default(autoincrement())
    key         String  @db.VarChar(255)
    description String?

    promptId Int
    prompt   Prompt @relation(fields: [promptId], references: [id], onDelete: Cascade)

    values PlaceholderValue[]

    createdAt DateTime @default(now()) @db.Timestamp(6)
    updatedAt DateTime @default(now()) @updatedAt @db.Timestamp(6)

    @@unique([key, promptId])
}

model PlaceholderValue {
    id            Int         @id @default(autoincrement())
    placeholderId Int
    placeholder   Placeholder @relation(fields: [placeholderId], references: [id], onDelete: Cascade)

    name      String  @db.VarChar(255)
    content   String
    isDefault Boolean @default(false)

    createdAt DateTime @default(now()) @db.Timestamp(6)
    updatedAt DateTime @default(now()) @updatedAt @db.Timestamp(6)

    testCases TestCasePlaceholderValue[]

    @@unique([placeholderId, name])
}

// `placeholderId` is denormalised so that @@unique([testCaseId, placeholderId]) can
// exist. Without it, "one key, one value" is not expressible in the database and a
// testcase holding both admin_role=true and admin_role=false becomes representable.
model TestCasePlaceholderValue {
    testCaseId         Int
    placeholderId      Int
    placeholderValueId Int

    testCase         TestCase         @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
    placeholderValue PlaceholderValue @relation(fields: [placeholderValueId], references: [id], onDelete: Cascade)

    @@id([testCaseId, placeholderValueId])
    @@unique([testCaseId, placeholderId])
}
```

In `apps/core/prisma/models/prompt.prisma`, add to `model Prompt` (next to `memories  Memory[]` on line 28):

```prisma
    placeholders Placeholder[]
```

and to `model PromptVersion`, next to `audit Json?`:

```prisma
    placeholders Json?
```

In `apps/core/prisma/models/testcase.prisma`, add to `model TestCase`:

```prisma
    placeholderValues TestCasePlaceholderValue[]
```

- [ ] **Step 2: Create the migration without applying it**

```bash
pnpm --filter core exec dotenv -e ../../.env -- pnpm prisma migrate dev --create-only --name add_prompt_placeholders
```

- [ ] **Step 3: Append the partial unique index to the generated SQL**

Prisma cannot express a partial unique index, so add it by hand at the end of the generated `migration.sql`. Without it, "the default" degrades into "whichever row is returned first".

```sql
-- At most one default value per placeholder.
CREATE UNIQUE INDEX "PlaceholderValue_one_default_per_placeholder"
    ON "PlaceholderValue" ("placeholderId")
    WHERE "isDefault";
```

- [ ] **Step 4: Apply and regenerate**

```bash
pnpm --filter core db:migrate:dev
pnpm prisma:generate
```

- [ ] **Step 5: Verify the client and the constraint**

Run: `pnpm --filter core type-check`
Expected: no new errors.

Then confirm the index really refuses a second default:

```bash
pnpm --filter core exec dotenv -e ../../.env -- psql "$DATABASE_URL" -c "\d \"PlaceholderValue\""
```

Expected: the output lists `PlaceholderValue_one_default_per_placeholder` as a partial unique index with `WHERE isDefault`. A constraint that cannot be seen failing is not a constraint — if it is absent, Step 3 was skipped.

- [ ] **Step 6: Commit**

```bash
git add apps/core/prisma
git commit -m "feat(placeholders): add placeholder models and the commit snapshot column"
```

---

### Task 3: Repository, validation and CRUD endpoints

The API the Placeholders tab talks to. Mirrors the memory endpoints it will replace (`PromptsRouter.ts:73-92`).

**Files:**
- Create: `apps/core/src/database/repositories/PlaceholdersRepository.ts`
- Create: `apps/core/src/services/validate/types/placeholder.type.ts`
- Modify: `apps/core/src/services/validate/index.ts`
- Modify: `apps/core/src/database/db.ts`
- Modify: `apps/core/src/controllers/prompt.controller.ts`
- Modify: `apps/core/src/routers/PromptsRouter.ts`
- Modify: `apps/core/src/services/access/AccessService.ts`
- Test: `apps/core/src/controllers/placeholder.controller.test.ts`

**Interfaces:**
- Consumes: the Prisma models from Task 2.
- Produces:
  - `db.placeholders.getPlaceholdersByPromptID(promptId: number)` → rows with `values` included, ordered by `id`.
  - `db.placeholders.getPlaceholderByIDAndPromptId(id: number, promptId: number)`
  - `db.placeholders.getPlaceholderByKeyAndPromptId(key: string, promptId: number)`
  - `db.placeholders.createPlaceholder(promptId: number, data: PlaceholderCreateType)`
  - `db.placeholders.updatePlaceholderByID(id: number, data: PlaceholderUpdateType)`
  - `db.placeholders.deletePlaceholderByID(id: number)`
  - `db.placeholders.createValue(placeholderId: number, data: PlaceholderValueCreateType)`
  - `db.placeholders.updateValueByID(id: number, data: PlaceholderValueUpdateType)`
  - `db.placeholders.deleteValueByID(id: number)`
  - `db.placeholders.getValueByIDAndPlaceholderId(id: number, placeholderId: number)`
  - `checkPlaceholderAccess(placeholderId: number, promptId: number)` from `AccessService`
  - REST: `GET|POST /prompts/:id/placeholders`, `GET|PUT|DELETE /prompts/:id/placeholders/:placeholderId`, `POST /prompts/:id/placeholders/:placeholderId/values`, `PUT|DELETE /prompts/:id/placeholders/:placeholderId/values/:valueId`

- [ ] **Step 1: Write the validation schemas**

`apps/core/src/services/validate/types/placeholder.type.ts`:

```ts
import { z } from "zod";
import { PLACEHOLDER_KEY_PATTERN } from "@genum/placeholders";

// The key is what the author types inside {{ }}, so it must be exactly what the
// renderer can find. Anything else creates a placeholder no substitution can reach.
const placeholderKey = z
	.string()
	.trim()
	.min(1)
	.max(64)
	.regex(new RegExp(`^${PLACEHOLDER_KEY_PATTERN.source.replace(/^\\\{\\\{|\\\}\\\}$/g, "")}$`), {
		message: "A placeholder key may contain only letters, digits and underscores.",
	});

export const PlaceholderCreateSchema = z
	.object({
		key: placeholderKey,
		description: z.string().max(500).nullish(),
	})
	.strict();

export type PlaceholderCreateType = z.infer<typeof PlaceholderCreateSchema>;

export const PlaceholderUpdateSchema = PlaceholderCreateSchema.partial().strict();
export type PlaceholderUpdateType = z.infer<typeof PlaceholderUpdateSchema>;

export const PlaceholderValueCreateSchema = z
	.object({
		name: z.string().trim().min(1).max(255),
		content: z.string(),
		isDefault: z.boolean().optional().default(false),
	})
	.strict();

export type PlaceholderValueCreateType = z.infer<typeof PlaceholderValueCreateSchema>;

export const PlaceholderValueUpdateSchema = z
	.object({
		name: z.string().trim().min(1).max(255),
		content: z.string(),
		isDefault: z.boolean(),
	})
	.partial()
	.strict();

export type PlaceholderValueUpdateType = z.infer<typeof PlaceholderValueUpdateSchema>;
```

The regex derivation above is fragile to read; if it does not compile cleanly, replace the `.regex(...)` argument with the literal `/^[a-zA-Z0-9_]+$/` **and** add this test to `packages/placeholders/src/detect.test.ts` so the two cannot drift:

```ts
it("pins the key character class the validator duplicates", () => {
	expect(PLACEHOLDER_KEY_PATTERN.source).toBe("\\{\\{([a-zA-Z0-9_]+)\\}\\}");
});
```

Add to `apps/core/src/services/validate/index.ts`:

```ts
export * from "./types/placeholder.type";
```

- [ ] **Step 2: Write the repository**

`apps/core/src/database/repositories/PlaceholdersRepository.ts`:

```ts
import type { PrismaClient } from "@/prisma";
import type {
	PlaceholderCreateType,
	PlaceholderUpdateType,
	PlaceholderValueCreateType,
	PlaceholderValueUpdateType,
} from "@/services/validate";

export class PlaceholdersRepository {
	private prisma: PrismaClient;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	public async getPlaceholdersByPromptID(promptId: number) {
		return await this.prisma.placeholder.findMany({
			where: { promptId },
			include: { values: { orderBy: { id: "asc" } } },
			orderBy: { id: "asc" },
		});
	}

	public async getPlaceholderByIDAndPromptId(id: number, promptId: number) {
		return await this.prisma.placeholder.findFirst({
			where: { id, promptId },
			include: { values: { orderBy: { id: "asc" } } },
		});
	}

	public async getPlaceholderByKeyAndPromptId(key: string, promptId: number) {
		return await this.prisma.placeholder.findFirst({ where: { key, promptId } });
	}

	public async createPlaceholder(promptId: number, data: PlaceholderCreateType) {
		return await this.prisma.placeholder.create({
			data: { key: data.key, description: data.description ?? null, promptId },
			include: { values: true },
		});
	}

	public async updatePlaceholderByID(id: number, data: PlaceholderUpdateType) {
		return await this.prisma.placeholder.update({
			where: { id },
			data,
			include: { values: { orderBy: { id: "asc" } } },
		});
	}

	public async deletePlaceholderByID(id: number) {
		return await this.prisma.placeholder.delete({ where: { id } });
	}

	public async getValueByIDAndPlaceholderId(id: number, placeholderId: number) {
		return await this.prisma.placeholderValue.findFirst({ where: { id, placeholderId } });
	}

	// isDefault is guarded by a partial unique index, so clearing the previous default
	// and setting the new one must happen in one transaction or the write can fail
	// against a default that is on its way out.
	public async createValue(placeholderId: number, data: PlaceholderValueCreateType) {
		return await this.prisma.$transaction(async (tx) => {
			if (data.isDefault) {
				await tx.placeholderValue.updateMany({
					where: { placeholderId, isDefault: true },
					data: { isDefault: false },
				});
			}

			return await tx.placeholderValue.create({
				data: {
					placeholderId,
					name: data.name,
					content: data.content,
					isDefault: data.isDefault ?? false,
				},
			});
		});
	}

	public async updateValueByID(id: number, data: PlaceholderValueUpdateType) {
		return await this.prisma.$transaction(async (tx) => {
			if (data.isDefault) {
				const current = await tx.placeholderValue.findUniqueOrThrow({ where: { id } });
				await tx.placeholderValue.updateMany({
					where: { placeholderId: current.placeholderId, isDefault: true },
					data: { isDefault: false },
				});
			}

			return await tx.placeholderValue.update({ where: { id }, data });
		});
	}

	public async deleteValueByID(id: number) {
		return await this.prisma.placeholderValue.delete({ where: { id } });
	}
}
```

Register it in `apps/core/src/database/db.ts` — add the import, the `public readonly placeholders: PlaceholdersRepository;` field, and `this.placeholders = new PlaceholdersRepository(prisma);` in the constructor, next to `this.memories`.

- [ ] **Step 3: Add the access guard**

In `apps/core/src/services/access/AccessService.ts`, next to `checkMemoryAccess` (line 19):

```ts
export async function checkPlaceholderAccess(placeholderId: number, promptId: number) {
	const placeholder = await db.placeholders.getPlaceholderByIDAndPromptId(placeholderId, promptId);
	if (!placeholder) {
		throw new HttpError(404, "Placeholder is not found");
	}
	return placeholder;
}
```

- [ ] **Step 4: Write the failing controller test**

`apps/core/src/controllers/placeholder.controller.test.ts` — follow the shape of `testcase.controller.test.ts`, mocking `@/database/db`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/database/db", () => ({
	db: {
		placeholders: {
			getPlaceholdersByPromptID: vi.fn(),
			getPlaceholderByIDAndPromptId: vi.fn(),
			getPlaceholderByKeyAndPromptId: vi.fn(),
			createPlaceholder: vi.fn(),
			createValue: vi.fn(),
		},
		prompts: { getPromptById: vi.fn() },
	},
}));

vi.mock("@/services/access/AccessService", () => ({
	checkPromptAccess: vi.fn(async () => ({ id: 1, projectId: 7 })),
	checkPlaceholderAccess: vi.fn(async () => ({ id: 5, promptId: 1 })),
}));

import { db } from "@/database/db";
import { PromptsController } from "./prompt.controller";

const PROMPT = 1;

function makeReq(body: unknown, params: Record<string, string>) {
	return {
		body,
		params,
		genumMeta: { ids: { projID: 7, orgID: 3, userID: 11 } },
	} as unknown as Request;
}

function makeRes() {
	const captured: { statusCode?: number; body?: unknown } = {};
	const res = {
		status(code: number) {
			captured.statusCode = code;
			return this;
		},
		json(body: unknown) {
			captured.body = body;
			return this;
		},
	} as unknown as Response;
	return { res, captured };
}

describe("placeholder endpoints", () => {
	let controller: PromptsController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new PromptsController();
	});

	it("refuses a duplicate key on the same prompt", async () => {
		vi.mocked(db.placeholders.getPlaceholderByKeyAndPromptId).mockResolvedValue({
			id: 5,
			key: "admin_role",
		} as never);
		const { res, captured } = makeRes();

		await controller.createPlaceholder(
			makeReq({ key: "admin_role" }, { id: String(PROMPT) }),
			res,
		);

		expect(captured.statusCode).toBe(400);
		expect(db.placeholders.createPlaceholder).not.toHaveBeenCalled();
	});

	it("rejects a key the renderer could never find", async () => {
		vi.mocked(db.placeholders.getPlaceholderByKeyAndPromptId).mockResolvedValue(null as never);
		const { res } = makeRes();

		// "th-ree" is not [a-zA-Z0-9_]+, so {{th-ree}} is not a placeholder at all.
		await expect(
			controller.createPlaceholder(makeReq({ key: "th-ree" }, { id: String(PROMPT) }), res),
		).rejects.toThrow();

		expect(db.placeholders.createPlaceholder).not.toHaveBeenCalled();
	});

	it("creates a value against the placeholder resolved for this prompt", async () => {
		vi.mocked(db.placeholders.createValue).mockResolvedValue({ id: 9 } as never);
		const { res, captured } = makeRes();

		await controller.createPlaceholderValue(
			makeReq(
				{ name: "true", content: "block", isDefault: true },
				{ id: String(PROMPT), placeholderId: "5" },
			),
			res,
		);

		expect(captured.statusCode).toBe(200);
		expect(db.placeholders.createValue).toHaveBeenCalledWith(5, {
			name: "true",
			content: "block",
			isDefault: true,
		});
	});
});
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `pnpm --filter core test:run src/controllers/placeholder.controller.test.ts`
Expected: FAIL — `controller.createPlaceholder is not a function`.

- [ ] **Step 6: Implement the controller methods**

In `apps/core/src/controllers/prompt.controller.ts`, next to the memory methods (lines 301-366), add — importing `PlaceholderCreateSchema`, `PlaceholderUpdateSchema`, `PlaceholderValueCreateSchema`, `PlaceholderValueUpdateSchema` from `@/services/validate` and `checkPlaceholderAccess` from `@/services/access/AccessService`:

```ts
	public async getPlaceholdersByPromptId(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const id = numberSchema.parse(req.params.id);
		await checkPromptAccess(id, metadata.projID);

		const placeholders = await db.placeholders.getPlaceholdersByPromptID(id);
		res.status(200).json({ placeholders });
	}

	public async createPlaceholder(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const data = PlaceholderCreateSchema.parse(req.body);
		await checkPromptAccess(promptId, metadata.projID);

		const existing = await db.placeholders.getPlaceholderByKeyAndPromptId(data.key, promptId);
		if (existing) {
			res.status(400).json({ error: "Placeholder key already exists. Key must be unique." });
			return;
		}

		const placeholder = await db.placeholders.createPlaceholder(promptId, data);
		res.status(200).json({ placeholder });
	}

	public async updatePlaceholder(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const placeholderId = numberSchema.parse(req.params.placeholderId);
		const data = PlaceholderUpdateSchema.parse(req.body);

		await checkPromptAccess(promptId, metadata.projID);
		await checkPlaceholderAccess(placeholderId, promptId);

		if (data.key) {
			const existing = await db.placeholders.getPlaceholderByKeyAndPromptId(
				data.key,
				promptId,
			);
			if (existing && existing.id !== placeholderId) {
				res.status(400).json({
					error: "Placeholder key already exists. Key must be unique.",
				});
				return;
			}
		}

		const placeholder = await db.placeholders.updatePlaceholderByID(placeholderId, data);
		res.status(200).json({ placeholder });
	}

	public async deletePlaceholder(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const placeholderId = numberSchema.parse(req.params.placeholderId);

		await checkPromptAccess(promptId, metadata.projID);
		await checkPlaceholderAccess(placeholderId, promptId);

		await db.placeholders.deletePlaceholderByID(placeholderId);
		res.status(200).json({ ok: true });
	}

	public async createPlaceholderValue(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const placeholderId = numberSchema.parse(req.params.placeholderId);
		const data = PlaceholderValueCreateSchema.parse(req.body);

		await checkPromptAccess(promptId, metadata.projID);
		await checkPlaceholderAccess(placeholderId, promptId);

		const value = await db.placeholders.createValue(placeholderId, data);
		res.status(200).json({ value });
	}

	public async updatePlaceholderValue(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const placeholderId = numberSchema.parse(req.params.placeholderId);
		const valueId = numberSchema.parse(req.params.valueId);
		const data = PlaceholderValueUpdateSchema.parse(req.body);

		await checkPromptAccess(promptId, metadata.projID);
		await checkPlaceholderAccess(placeholderId, promptId);

		const existing = await db.placeholders.getValueByIDAndPlaceholderId(valueId, placeholderId);
		if (!existing) {
			res.status(404).json({ error: "Placeholder value is not found" });
			return;
		}

		const value = await db.placeholders.updateValueByID(valueId, data);
		res.status(200).json({ value });
	}

	public async deletePlaceholderValue(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const placeholderId = numberSchema.parse(req.params.placeholderId);
		const valueId = numberSchema.parse(req.params.valueId);

		await checkPromptAccess(promptId, metadata.projID);
		await checkPlaceholderAccess(placeholderId, promptId);

		const existing = await db.placeholders.getValueByIDAndPlaceholderId(valueId, placeholderId);
		if (!existing) {
			res.status(404).json({ error: "Placeholder value is not found" });
			return;
		}

		await db.placeholders.deleteValueByID(valueId);
		res.status(200).json({ ok: true });
	}
```

- [ ] **Step 7: Register the routes**

In `apps/core/src/routers/PromptsRouter.ts`, directly below the memories block (line 92):

```ts
	// Placeholders endpoints
	router.get(
		"/:id/placeholders",
		asyncHandler(promptsController.getPlaceholdersByPromptId.bind(promptsController)),
	);
	router.post(
		"/:id/placeholders",
		asyncHandler(promptsController.createPlaceholder.bind(promptsController)),
	);
	router.put(
		"/:id/placeholders/:placeholderId",
		asyncHandler(promptsController.updatePlaceholder.bind(promptsController)),
	);
	router.delete(
		"/:id/placeholders/:placeholderId",
		asyncHandler(promptsController.deletePlaceholder.bind(promptsController)),
	);
	router.post(
		"/:id/placeholders/:placeholderId/values",
		asyncHandler(promptsController.createPlaceholderValue.bind(promptsController)),
	);
	router.put(
		"/:id/placeholders/:placeholderId/values/:valueId",
		asyncHandler(promptsController.updatePlaceholderValue.bind(promptsController)),
	);
	router.delete(
		"/:id/placeholders/:placeholderId/values/:valueId",
		asyncHandler(promptsController.deletePlaceholderValue.bind(promptsController)),
	);
```

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter core test:run src/controllers/placeholder.controller.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 9: Commit**

```bash
git add apps/core/src
git commit -m "feat(placeholders): add repository, validation and CRUD endpoints"
```

---

### Task 4: Render placeholders inside `runPrompt`

Replace `instruction += memory.value` (`run.ts:154-162`) with the renderer, reading live definitions. The commit snapshot arrives in Task 5.

**Files:**
- Create: `apps/core/src/ai/placeholders/definitions.ts`
- Test: `apps/core/src/ai/placeholders/definitions.test.ts`
- Modify: `apps/core/src/ai/runner/run.ts`
- Modify: `apps/core/src/ai/runner/types.ts`
- Modify: `apps/core/src/controllers/prompt.controller.ts:79-89` (the playground run)

**Interfaces:**
- Consumes: `renderPlaceholders`, `PlaceholderDefinition`, `PlaceholderSelection` (Task 1); `db.placeholders.getPlaceholdersByPromptID` (Task 3).
- Produces:
  - `toPlaceholderDefinitions(rows): PlaceholderDefinition[]` — Prisma rows → the pure type.
  - `parsePlaceholderSnapshot(value: unknown): PlaceholderDefinition[]` — `PromptVersion.placeholders` JSON → the pure type; `[]` for `null` or anything malformed.
  - `runPromptParams` gains `placeholders?: PlaceholderSelection` and keeps `memoryId` until Task 11.
  - `runPrompt` returns the existing completion plus `placeholders: { resolved, ignored, undefinedKeys }`.

- [ ] **Step 1: Write the failing mapper test**

`apps/core/src/ai/placeholders/definitions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parsePlaceholderSnapshot, toPlaceholderDefinitions } from "./definitions";

describe("toPlaceholderDefinitions", () => {
	it("keeps only what the renderer needs", () => {
		const rows = [
			{
				id: 1,
				key: "admin_role",
				description: "author note",
				promptId: 3,
				values: [
					{ id: 10, name: "false", content: "", isDefault: true, placeholderId: 1 },
					{ id: 11, name: "true", content: "block", isDefault: false, placeholderId: 1 },
				],
			},
		];

		expect(toPlaceholderDefinitions(rows as never)).toEqual([
			{
				key: "admin_role",
				values: [
					{ name: "false", content: "", isDefault: true },
					{ name: "true", content: "block", isDefault: false },
				],
			},
		]);
	});
});

describe("parsePlaceholderSnapshot", () => {
	it("reads a committed snapshot", () => {
		const snapshot = [
			{ key: "k", values: [{ name: "v", content: "c", isDefault: true }] },
		];

		expect(parsePlaceholderSnapshot(snapshot)).toEqual(snapshot);
	});

	it("treats a version committed before this feature as having no definitions", () => {
		expect(parsePlaceholderSnapshot(null)).toEqual([]);
		expect(parsePlaceholderSnapshot(undefined)).toEqual([]);
	});

	it("refuses malformed JSON rather than crashing a run", () => {
		expect(parsePlaceholderSnapshot({ nope: true })).toEqual([]);
		expect(parsePlaceholderSnapshot([{ key: 1 }])).toEqual([]);
	});
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter core test:run src/ai/placeholders/definitions.test.ts`
Expected: FAIL — cannot resolve `./definitions`.

- [ ] **Step 3: Implement the mappers**

`apps/core/src/ai/placeholders/definitions.ts`:

```ts
import type { Placeholder, PlaceholderValue } from "@/prisma";
import type { PlaceholderDefinition } from "@genum/placeholders";

type PlaceholderRow = Placeholder & { values: PlaceholderValue[] };

export function toPlaceholderDefinitions(rows: PlaceholderRow[]): PlaceholderDefinition[] {
	return rows.map((row) => ({
		key: row.key,
		values: row.values.map((value) => ({
			name: value.name,
			content: value.content,
			isDefault: value.isDefault,
		})),
	}));
}

/**
 * `PromptVersion.placeholders` is Json, so it can hold anything a past or future
 * version of this code wrote. A malformed snapshot must degrade to "no definitions"
 * — which renders every hole as itself — rather than throw inside a paid run.
 */
export function parsePlaceholderSnapshot(value: unknown): PlaceholderDefinition[] {
	if (!Array.isArray(value)) return [];

	const definitions: PlaceholderDefinition[] = [];
	for (const entry of value) {
		if (typeof entry !== "object" || entry === null) return [];
		const candidate = entry as Record<string, unknown>;
		if (typeof candidate.key !== "string" || !Array.isArray(candidate.values)) return [];

		const values = [];
		for (const raw of candidate.values) {
			if (typeof raw !== "object" || raw === null) return [];
			const v = raw as Record<string, unknown>;
			if (
				typeof v.name !== "string" ||
				typeof v.content !== "string" ||
				typeof v.isDefault !== "boolean"
			) {
				return [];
			}
			values.push({ name: v.name, content: v.content, isDefault: v.isDefault });
		}

		definitions.push({ key: candidate.key, values });
	}

	return definitions;
}
```

- [ ] **Step 4: Run the mapper test**

Run: `pnpm --filter core test:run src/ai/placeholders/definitions.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Wire the renderer into `runPrompt`**

In `apps/core/src/ai/runner/types.ts`, add to `runPromptParams`:

```ts
	placeholders?: PlaceholderSelection;
```

In `apps/core/src/ai/runner/run.ts`, replace the memory block at lines 153-162 with:

```ts
	// Placeholders. Definitions come from the same object the text came from: for a
	// productive run that is the commit snapshot (see getPromptWithProductiveCommit),
	// otherwise the live tables. Reading them from different places is exactly the
	// drift this feature exists to remove.
	const definitions = data.placeholderDefinitions
		? data.placeholderDefinitions
		: toPlaceholderDefinitions(await db.placeholders.getPlaceholdersByPromptID(prompt.id));

	const render = renderPlaceholders(instruction, definitions, data.placeholders ?? {});
	instruction = render.text;
```

Add to `runPromptParams` in `types.ts` alongside the selection:

```ts
	/** Committed definitions, when the caller resolved a productive commit. */
	placeholderDefinitions?: PlaceholderDefinition[];
```

Replace both `memory_key: memoryKey` arguments to `logUsage` (lines 212 and 240) with:

```ts
			placeholders: toLogPlaceholders(render.resolved),
```

`toLogPlaceholders` arrives in Task 6; until then, define it locally in `run.ts` as

```ts
const toLogPlaceholders = (resolved: Record<string, string | null>) =>
	Object.fromEntries(Object.entries(resolved).map(([key, name]) => [key, name ?? ""]));
```

and move it in Task 6. Return the render report by extending the success return:

```ts
		return {
			...completion,
			cost,
			placeholders: {
				resolved: render.resolved,
				ignored: render.ignored,
				undefinedKeys: render.undefinedKeys,
			},
		};
```

Delete the now-unused `memoryKey` variable and the `db.memories.getMemoryByIDAndPromptId` call. `memoryId` stays on `runPromptParams` — Task 11 removes it — but nothing reads it any more.

- [ ] **Step 6: Pass the selection from the playground run**

In `apps/core/src/controllers/prompt.controller.ts:79`, `PromptRunSchema.parse(req.body)` currently yields `memoryId`. Add `placeholders` to `PromptRunSchema` in `apps/core/src/services/validate/types/prompt.type.ts`:

```ts
	placeholders: z.record(z.string(), z.string()).optional(),
```

and pass it through at line 89:

```ts
			placeholders: placeholders ?? {},
```

- [ ] **Step 7: Type-check and run the full core suite**

Run: `pnpm --filter core type-check && pnpm --filter core test:run`
Expected: no new type errors; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/core/src
git commit -m "feat(placeholders): render placeholders in runPrompt instead of appending memory"
```

---

### Task 5: Commit and read the snapshot

**Files:**
- Modify: `apps/core/src/database/repositories/PromptsRepository.ts` (the commit write)
- Modify: `apps/core/src/services/prompt.service.ts:171-187`
- Test: `apps/core/src/services/prompt.service.test.ts`

**Interfaces:**
- Consumes: `toPlaceholderDefinitions`, `parsePlaceholderSnapshot` (Task 4).
- Produces: `getPromptWithProductiveCommit` returns the prompt with a fourth substituted field, `placeholderDefinitions: PlaceholderDefinition[]`.

- [ ] **Step 1: Write the failing service test**

`apps/core/src/services/prompt.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptService } from "./prompt.service";

const db = {
	prompts: { getProductiveCommit: vi.fn() },
} as never;

describe("getPromptWithProductiveCommit", () => {
	let service: PromptService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new PromptService(db);
	});

	it("takes the definitions from the same commit as the text", async () => {
		vi.mocked((db as never as { prompts: { getProductiveCommit: ReturnType<typeof vi.fn> } })
			.prompts.getProductiveCommit).mockResolvedValue({
			value: "committed text {{k}}",
			languageModelConfig: {},
			languageModelId: 2,
			placeholders: [{ key: "k", values: [{ name: "v", content: "c", isDefault: true }] }],
		} as never);

		const result = await service.getPromptWithProductiveCommit({
			id: 1,
			value: "live text",
			languageModelConfig: {},
			languageModelId: 1,
		} as never);

		expect(result?.value).toBe("committed text {{k}}");
		expect(result?.placeholderDefinitions).toEqual([
			{ key: "k", values: [{ name: "v", content: "c", isDefault: true }] },
		]);
	});

	it("gives a pre-feature commit no definitions rather than the live ones", async () => {
		vi.mocked((db as never as { prompts: { getProductiveCommit: ReturnType<typeof vi.fn> } })
			.prompts.getProductiveCommit).mockResolvedValue({
			value: "old text",
			languageModelConfig: {},
			languageModelId: 2,
			placeholders: null,
		} as never);

		const result = await service.getPromptWithProductiveCommit({ id: 1 } as never);

		expect(result?.placeholderDefinitions).toEqual([]);
	});
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter core test:run src/services/prompt.service.test.ts`
Expected: FAIL — `placeholderDefinitions` is undefined.

- [ ] **Step 3: Substitute the fourth field**

In `apps/core/src/services/prompt.service.ts:181`:

```ts
		return {
			...prompt,
			value: productiveCommit.value,
			languageModelConfig: productiveCommit.languageModelConfig,
			languageModelId: productiveCommit.languageModelId,
			placeholderDefinitions: parsePlaceholderSnapshot(productiveCommit.placeholders),
		};
```

and in the no-commit branch at line 178, return `{ ...prompt, placeholderDefinitions: [] }` when `requireCommit` is false, so callers never see the field missing.

- [ ] **Step 4: Snapshot on commit**

Find the method in `PromptsRepository.ts` that creates a `promptVersion` row and add `placeholders` to its `data`, built from the prompt's live placeholders:

```ts
		const placeholders = toPlaceholderDefinitions(
			await this.prisma.placeholder.findMany({
				where: { promptId },
				include: { values: { orderBy: { id: "asc" } } },
				orderBy: { id: "asc" },
			}),
		);
```

then pass `placeholders: placeholders as unknown as Prisma.InputJsonValue` into the `promptVersion.create` call.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter core test:run src/services/prompt.service.test.ts && pnpm --filter core type-check`
Expected: PASS, 2 tests; no new type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src
git commit -m "feat(placeholders): commit definitions with the prompt and read them back"
```

---

### Task 6: Record the selection on every run

**Files:**
- Modify: `apps/core/clickhouse/init.sql`
- Modify: `apps/core/src/services/logger/types.ts:55,198`
- Modify: `apps/core/src/services/logger/logger.ts:159,194`
- Modify: `apps/core/src/services/logger/mappers.ts`
- Test: `apps/core/src/services/logger/mappers.test.ts`

**Interfaces:**
- Consumes: `render.resolved` (Task 4).
- Produces:
  - `toLogPlaceholders(resolved: Record<string, string | null>): Record<string, string>` in `mappers.ts`.
  - `resolveLogPlaceholders(row: { placeholders?: Record<string, string>; memory_key?: string | null }): Record<string, string> | undefined` in `mappers.ts`.
  - `LogDocument.placeholders?: Record<string, string>`; `ClickHouseLogRow.placeholders: Record<string, string>`.

- [ ] **Step 1: Add the column**

At the end of `apps/core/clickhouse/init.sql` — the file is replayed on every init, so the statement must be idempotent:

```sql
-- Added 2026-09-01 with prompt placeholders. `memory_key` above is frozen: it stays
-- readable for rows written before this column existed and is never written again.
ALTER TABLE {{DB_NAME}}.logs
    ADD COLUMN IF NOT EXISTS placeholders Map(LowCardinality(String), LowCardinality(String));
```

- [ ] **Step 2: Write the failing mapper test**

Append to `apps/core/src/services/logger/mappers.test.ts`:

```ts
import { resolveLogPlaceholders, toLogPlaceholders } from "./mappers";

describe("toLogPlaceholders", () => {
	it("writes an unresolved key as an empty string", () => {
		// A ClickHouse Map has no null value, and dropping the entry would make
		// "no value resolved" indistinguishable from "the key was not in the text".
		expect(toLogPlaceholders({ admin_role: "true", memory_key: null })).toEqual({
			admin_role: "true",
			memory_key: "",
		});
	});
});

describe("resolveLogPlaceholders", () => {
	it("returns the map when the row has one", () => {
		expect(resolveLogPlaceholders({ placeholders: { admin_role: "true" } })).toEqual({
			admin_role: "true",
		});
	});

	it("presents a legacy memory_key row as a memory_key placeholder", () => {
		expect(resolveLogPlaceholders({ placeholders: {}, memory_key: "client_bmw" })).toEqual({
			memory_key: "client_bmw",
		});
	});

	it("returns undefined when the row carries neither", () => {
		expect(resolveLogPlaceholders({ placeholders: {}, memory_key: null })).toBeUndefined();
	});
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm --filter core test:run src/services/logger/mappers.test.ts`
Expected: FAIL — no such exports.

- [ ] **Step 4: Implement both mappers**

Append to `apps/core/src/services/logger/mappers.ts`:

```ts
export function toLogPlaceholders(
	resolved: Record<string, string | null>,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(resolved).map(([key, name]) => [key, name ?? ""]),
	);
}

export function resolveLogPlaceholders(row: {
	placeholders?: Record<string, string>;
	memory_key?: string | null;
}): Record<string, string> | undefined {
	if (row.placeholders && Object.keys(row.placeholders).length > 0) {
		return row.placeholders;
	}
	if (row.memory_key) {
		return { memory_key: row.memory_key };
	}
	return undefined;
}
```

- [ ] **Step 5: Use them in the logger**

In `apps/core/src/services/logger/types.ts`, add `placeholders?: Record<string, string>;` to `LogDocument` (near line 55) and `placeholders: Record<string, string>;` to `ClickHouseLogRow` (near line 198).

In `logger.ts`, inside `transformRowToLogDocument` (line ~159) replace `memory_key: row.memory_key || undefined` with:

```ts
		placeholders: resolveLogPlaceholders(row),
```

and inside `logUsage` (line ~194) replace `memory_key: document.memory_key || null` with:

```ts
					placeholders: document.placeholders ?? {},
```

In `run.ts`, delete the local `toLogPlaceholders` added in Task 4 and import it from `@/services/logger/mappers`.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter core test:run src/services/logger/mappers.test.ts && pnpm --filter core type-check`
Expected: PASS; no new type errors.

- [ ] **Step 7: Verify the column exists on a real ClickHouse**

```bash
pnpm --filter core clickhouse:init:dev
pnpm --filter core exec dotenv -e ../../.env -- sh -c 'curl -s "$CLICKHOUSE_URL" --data "DESCRIBE TABLE genum.logs" | grep placeholders'
```

Expected: one row naming `placeholders` with type `Map(LowCardinality(String), LowCardinality(String))`. Run the init twice — the second run must not error, or the statement is not idempotent.

- [ ] **Step 8: Commit**

```bash
git add apps/core
git commit -m "feat(placeholders): record the resolved selection on every run"
```

---

### Task 7: Public API — `placeholders` plus the deprecated `memoryKey`

**Files:**
- Modify: `apps/core/src/services/validate/types/apiv1.type.ts:12-22`
- Create: `apps/core/src/ai/placeholders/merge-input.ts`
- Test: `apps/core/src/ai/placeholders/merge-input.test.ts`
- Modify: `apps/core/src/controllers/apiv1.controller.ts:100-140`
- Modify: `apps/web/src/pages/prompt/playground-tabs/api/Api.tsx:32` (the documented example)

**Interfaces:**
- Consumes: `PlaceholderSelection` (Task 1).
- Produces: `mergePlaceholderInput(input: { placeholders?: PlaceholderSelection; memoryKey?: string }): PlaceholderSelection`.

- [ ] **Step 1: Write the failing merge test**

`apps/core/src/ai/placeholders/merge-input.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mergePlaceholderInput } from "./merge-input";

describe("mergePlaceholderInput", () => {
	it("folds the deprecated memoryKey into the memory_key placeholder", () => {
		expect(mergePlaceholderInput({ memoryKey: "client_bmw" })).toEqual({
			memory_key: "client_bmw",
		});
	});

	it("lets an explicit placeholders entry win over the deprecated field", () => {
		expect(
			mergePlaceholderInput({
				placeholders: { memory_key: "explicit" },
				memoryKey: "legacy",
			}),
		).toEqual({ memory_key: "explicit" });
	});

	it("passes other keys through untouched", () => {
		expect(
			mergePlaceholderInput({ placeholders: { admin_role: "true" }, memoryKey: "legacy" }),
		).toEqual({ admin_role: "true", memory_key: "legacy" });
	});

	it("returns an empty selection when neither field is given", () => {
		expect(mergePlaceholderInput({})).toEqual({});
	});
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter core test:run src/ai/placeholders/merge-input.test.ts`
Expected: FAIL — cannot resolve `./merge-input`.

- [ ] **Step 3: Implement it**

`apps/core/src/ai/placeholders/merge-input.ts`:

```ts
import type { PlaceholderSelection } from "@genum/placeholders";

export const LEGACY_MEMORY_PLACEHOLDER_KEY = "memory_key";

/**
 * The only place the deprecated `memoryKey` field survives. `RunPromptSchema` is
 * `.strict()`, so removing the field would answer an existing integrator with a 400
 * rather than a degradation — but everything downstream sees one shape.
 */
export function mergePlaceholderInput(input: {
	placeholders?: PlaceholderSelection;
	memoryKey?: string;
}): PlaceholderSelection {
	const selection: PlaceholderSelection = { ...(input.placeholders ?? {}) };

	if (input.memoryKey && selection[LEGACY_MEMORY_PLACEHOLDER_KEY] === undefined) {
		selection[LEGACY_MEMORY_PLACEHOLDER_KEY] = input.memoryKey;
	}

	return selection;
}
```

- [ ] **Step 4: Extend the request schema**

In `apps/core/src/services/validate/types/apiv1.type.ts`, inside `RunPromptSchema`:

```ts
		placeholders: z.record(z.string(), z.string()).optional(),
		/** @deprecated use `placeholders: { memory_key: "..." }` */
		memoryKey: z.string().optional(),
```

- [ ] **Step 5: Use it in the controller**

In `apps/core/src/controllers/apiv1.controller.ts:100`, replace the destructure and the memory lookup at lines 119-127 with:

```ts
		const { id, question, memoryKey, placeholders, productive, files } = RunPromptSchema.parse(
			req.body,
		);
		const selection = mergePlaceholderInput({ placeholders, memoryKey });
```

Pass **both** into the `runPrompt` call. The selection comes from the request; the definitions come
off the object `getPromptWithProductiveCommit` returned, so that a productive run's text and its
definitions provably originate in the same commit:

```ts
			placeholders: selection,
			placeholderDefinitions: promptWithCommit.placeholderDefinitions,
```

For the non-productive branch of this controller, pass only `placeholders: selection` and let
`run.ts` read the live definitions. Then add the report to the response body:

```ts
			placeholders: {
				resolved: result.placeholders.resolved,
				ignored: result.placeholders.ignored,
			},
```

- [ ] **Step 6: Update the documented example**

In `apps/web/src/pages/prompt/playground-tabs/api/Api.tsx:32`, replace the `memoryKey` line with:

```
  "placeholders": { "admin_role": "true" }, // Optional: one value per placeholder key
```

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter core test:run src/ai/placeholders && pnpm --filter core test:run src/controllers/apiv1.controller.test.ts`
Expected: PASS; the existing apiv1 tests still pass.

- [ ] **Step 8: Commit**

```bash
git add apps/core apps/web/src/pages/prompt/playground-tabs/api/Api.tsx
git commit -m "feat(placeholders): accept a placeholder selection on the public run API"
```

---

### Task 8: A testcase pins a selection

**Files:**
- Modify: `apps/core/src/database/repositories/PlaceholdersRepository.ts`
- Modify: `apps/core/src/database/repositories/TestcasesRepository.ts`
- Modify: `apps/core/src/services/validate/types/testcase.type.ts`
- Modify: `apps/core/src/controllers/testcase.controller.ts:33-60,92-99,142`
- Test: `apps/core/src/controllers/testcase.controller.test.ts`

**Interfaces:**
- Consumes: `db.placeholders` (Task 3).
- Produces:
  - `db.placeholders.resolveSelection(promptId: number, selection: PlaceholderSelection)` → `{ rows: { placeholderId: number; placeholderValueId: number }[]; unresolved: string[] }`
  - `db.testcases.setPlaceholderSelection(testCaseId: number, rows)` — replaces the whole selection in one transaction.
  - `TestcasesCreateWithoutNameSchema` / the update schema accept `placeholders?: Record<string, string>`.
  - Create/update responses carry `unresolvedPlaceholders: string[]`.

- [ ] **Step 1: Write the failing controller tests**

Append to `apps/core/src/controllers/testcase.controller.test.ts` — the second test is the port of the existing "refuses a memory belonging to another prompt", and it must not be dropped when `memoryId` goes away in Task 11:

```ts
	it("pins the resolved values on the testcase", async () => {
		vi.mocked(db.placeholders.resolveSelection).mockResolvedValue({
			rows: [{ placeholderId: 5, placeholderValueId: 9 }],
			unresolved: [],
		} as never);
		const { res, captured } = makeRes();

		await controller.createTestcase(
			makeReq({ promptId: PROMPT, input: "i", expectedOutput: "e", lastOutput: "",
				placeholders: { admin_role: "true" } }),
			res,
		);

		expect(captured.statusCode).toBe(200);
		expect(db.testcases.setPlaceholderSelection).toHaveBeenCalledWith(expect.any(Number), [
			{ placeholderId: 5, placeholderValueId: 9 },
		]);
	});

	it("refuses a placeholder value belonging to another prompt", async () => {
		// The guard `memoryId` used to carry: resolution is scoped to this prompt, so a
		// value id from another tenant's prompt is simply not resolvable here.
		vi.mocked(db.placeholders.resolveSelection).mockResolvedValue({
			rows: [],
			unresolved: ["admin_role"],
		} as never);
		const { res, captured } = makeRes();

		await controller.createTestcase(
			makeReq({ promptId: PROMPT, input: "i", expectedOutput: "e", lastOutput: "",
				placeholders: { admin_role: "true" } }),
			res,
		);

		expect(db.testcases.setPlaceholderSelection).toHaveBeenCalledWith(expect.any(Number), []);
		expect((captured.body as { unresolvedPlaceholders: string[] }).unresolvedPlaceholders)
			.toEqual(["admin_role"]);
	});
```

Add `placeholders: { resolveSelection: vi.fn() }` and `testcases.setPlaceholderSelection: vi.fn()` to the file's existing `vi.mock("@/database/db", ...)` factory.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter core test:run src/controllers/testcase.controller.test.ts`
Expected: FAIL — `db.placeholders.resolveSelection is not a function`.

- [ ] **Step 3: Implement resolution**

Add to `PlaceholdersRepository`:

```ts
	/**
	 * Names -> ids, scoped to one prompt. Scoping is the guard: a value id belonging to
	 * another prompt is unreachable rather than merely rejected, which is what
	 * `checkMemoryAccess` had to do by hand for `memoryId`.
	 */
	public async resolveSelection(promptId: number, selection: Record<string, string>) {
		const keys = Object.keys(selection);
		if (keys.length === 0) return { rows: [], unresolved: [] };

		const placeholders = await this.prisma.placeholder.findMany({
			where: { promptId, key: { in: keys } },
			include: { values: true },
		});

		const rows: { placeholderId: number; placeholderValueId: number }[] = [];
		const unresolved: string[] = [];

		for (const key of keys) {
			const placeholder = placeholders.find((candidate) => candidate.key === key);
			const value = placeholder?.values.find((entry) => entry.name === selection[key]);
			if (!placeholder || !value) {
				unresolved.push(key);
				continue;
			}
			rows.push({ placeholderId: placeholder.id, placeholderValueId: value.id });
		}

		return { rows, unresolved };
	}
```

Add to `TestcasesRepository`:

```ts
	public async setPlaceholderSelection(
		testCaseId: number,
		rows: { placeholderId: number; placeholderValueId: number }[],
	) {
		return await this.prisma.$transaction(async (tx) => {
			await tx.testCasePlaceholderValue.deleteMany({ where: { testCaseId } });
			if (rows.length === 0) return;
			await tx.testCasePlaceholderValue.createMany({
				data: rows.map((row) => ({ ...row, testCaseId })),
			});
		});
	}
```

- [ ] **Step 4: Wire it into the controller**

In `createTestcase` and `updateTestcase`, after the testcase row is written:

```ts
		const { rows, unresolved } = await db.placeholders.resolveSelection(
			prompt.id,
			data.placeholders ?? {},
		);
		await db.testcases.setPlaceholderSelection(testcase.id, rows);
```

and include `unresolvedPlaceholders: unresolved` in the JSON response. Add `placeholders: z.record(z.string(), z.string()).optional()` to the create and update schemas in `testcase.type.ts`. Include the pinned selection when reading a testcase, so the playground can restore it:

```ts
	include: { placeholderValues: { include: { placeholderValue: true } } },
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter core test:run src/controllers/testcase.controller.test.ts && pnpm --filter core type-check`
Expected: PASS including the two new tests; no new type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src
git commit -m "feat(placeholders): pin a placeholder selection on a testcase"
```

---

### Task 9: Frontend — API client, store and the playground chips

**Files:**
- Create: `apps/web/src/api/prompt/placeholder.api.ts`
- Create: `apps/web/src/query-keys/placeholder.keys.ts`
- Create: `apps/web/src/pages/prompt/playground-tabs/placeholders/hooks/usePromptPlaceholders.ts`
- Create: `apps/web/src/pages/prompt/playground-tabs/playground/components/prompt-editor/components/PlaceholderChips.tsx`
- Modify: `apps/web/src/stores/playground.store.ts:7-8,107-108`
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/Playground.tsx` (render the chips under `TextEditor`)
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/hooks/usePlaygroundPromptRun.ts` (send the selection)

**Interfaces:**
- Consumes: `detectPlaceholderKeys` from `@genum/placeholders` (Task 1); `GET /prompts/:id/placeholders` (Task 3); the run body field `placeholders` (Task 4 Step 6).
- Produces:
  - `placeholderApi.getPromptPlaceholders(promptId)` → `{ placeholders: PromptPlaceholder[] }`
  - `type PromptPlaceholder = { id: number; key: string; description: string | null; values: PromptPlaceholderValue[] }`
  - `type PromptPlaceholderValue = { id: number; name: string; content: string; isDefault: boolean }`
  - `placeholderKeys.promptPlaceholders(promptId)`
  - store: `selectedPlaceholders: Record<string, string>`, `setPlaceholderSelection(key, valueName)`, `clearPlaceholderSelection(key)`

- [ ] **Step 1: Add the API module and query keys**

`apps/web/src/query-keys/placeholder.keys.ts`:

```ts
type ScopeParam = string | number | undefined;

export const placeholderKeys = {
	promptPlaceholders: (promptId: ScopeParam) => ["prompt-placeholders", promptId] as const,
};
```

`apps/web/src/api/prompt/placeholder.api.ts` — mirror the memory functions in `prompt.api.ts:342-395`, with `getPromptPlaceholders`, `createPlaceholder`, `updatePlaceholder`, `deletePlaceholder`, `createPlaceholderValue`, `updatePlaceholderValue`, `deletePlaceholderValue`, hitting the routes registered in Task 3.

- [ ] **Step 2: Replace the memory selection in the store**

In `apps/web/src/stores/playground.store.ts`, replace `selectedMemoryId` / `selectedMemoryKeyName` (lines 7-8 and defaults at 107-108) with:

```ts
	selectedPlaceholders: Record<string, string>;
```

default `{}`, plus the two actions from Interfaces. Leave the memory-value draft helpers alone; Task 11 deletes them with the rest.

- [ ] **Step 3: Build the chips**

`PlaceholderChips.tsx` renders one chip per key returned by `detectPlaceholderKeys(livePromptValue)`:

- key with a definition → `<Popover>` listing its values, the `isDefault` one labelled `default`, the selected one checked; clicking sets `setPlaceholderSelection(key, name)`, clicking the selected one clears it.
- key with no definition → a red chip reading `{key} — not defined` whose click opens the Placeholders tab (Task 10) for that prompt.
- more than six chips → render the first six and a `+N` that expands.

The chip label shows the effective value: the selection if there is one, otherwise the default's name in muted text, otherwise an em dash.

- [ ] **Step 4: Mount them and send the selection**

In `Playground.tsx`, render `<PlaceholderChips promptId={promptId} text={prompt.content} />` immediately after `<TextEditor ... />` inside the same card. Pass `livePromptValue` (`usePlaygroundPrompt.ts:36`) as `text` — not the saved prompt, or the chips lag a keystroke behind the editor.

In `usePlaygroundPromptRun.ts`, add `placeholders: selectedPlaceholders` to the run request body.

- [ ] **Step 5: Verify**

Run: `pnpm --filter web build`
Expected: succeeds.

Then manually, with `pnpm dev`: open a prompt, type `{{admin_role}}` into System Instructions and watch a red `not defined` chip appear **as you type**, before saving. Define the placeholder through the API (`POST /prompts/:id/placeholders`) and confirm the chip turns normal and offers its values.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(placeholders): detect and select placeholders in the playground"
```

---

### Task 10: Frontend — the Placeholders tab, testcase column and add-from-log

**Files:**
- Create: `apps/web/src/pages/prompt/playground-tabs/placeholders/Placeholders.tsx`
- Create: `apps/web/src/pages/prompt/playground-tabs/placeholders/components/PlaceholderList.tsx`
- Create: `apps/web/src/pages/prompt/playground-tabs/placeholders/components/PlaceholderValueEditor.tsx`
- Create: `apps/web/src/pages/prompt/playground-tabs/placeholders/hooks/usePlaceholderMutations.ts`
- Modify: `apps/web/src/pages/prompt/playground-tabs/PlaygroundWorkspace.tsx` (tab registration)
- Modify: `apps/web/src/hooks/useTestcasesColumns.tsx:100-111`
- Modify: `apps/web/src/pages/prompt/playground-tabs/logs/hooks/useAddTestcaseFromLog.ts`
- Modify: `apps/web/src/pages/logs/hooks/useProjectLogsData.ts` and `.../logs/hooks/useLogsData.ts` (drop the memories query)

**Interfaces:**
- Consumes: everything from Task 9; `unresolvedPlaceholders` from Task 8.
- Produces: the `placeholders` tab route segment, replacing `memory`.

- [ ] **Step 1: Build the master–detail tab**

`Placeholders.tsx` — the approved layout: a search input and a `New placeholder` button on top; on the left a list of keys, each row showing its value count and whether the key occurs in the prompt text (`detectPlaceholderKeys` over the saved prompt value); on the right the selected key's values, each in a card with its name, a `default` badge or a `Make default` action, a full-width `Textarea` for `content` saved on blur, and a delete action.

Deleting a value must state how many testcases pin it **before** the delete. Extend `getPromptPlaceholders` to include that count (`_count` on the join relation) and render it in the confirm dialog.

Register the tab where `memory` is registered in `PlaygroundWorkspace.tsx`, under the segment `placeholders`.

- [ ] **Step 2: Swap the testcase column**

In `useTestcasesColumns.tsx:100`, replace the `memoryKey` column with a `placeholders` column rendering `key: value` pairs, joined by `·`, or `-` when the testcase pins nothing.

- [ ] **Step 3: Move add-from-log onto names**

Rewrite `useAddTestcaseFromLog.ts` so it stops matching memories in the browser (`memoriesData.find(...)`, line 33) and instead passes the log's map straight through:

```ts
			const ok = await createTestcase({
				promptId: targetPromptId,
				input: selectedLog.in || "",
				expectedOutput: selectedLog.out || "",
				lastOutput: selectedLog.out || "",
				placeholders: selectedLog.placeholders ?? {},
			});
```

Drop the `memoriesData` parameter and the `memoryKeys.promptMemories` queries in the two `useLogsData` hooks that only existed to feed it. When the create response reports `unresolvedPlaceholders`, show them in the toast — a value that has since been renamed or deleted cannot transfer, and saying so is the difference between a partial transfer and a silent one.

Add `placeholders?: Record<string, string>` to the `Log` type in `apps/web/src/api/prompt/prompt.api.ts:181`, next to the existing `memory_key`.

- [ ] **Step 4: Verify**

Run: `pnpm --filter web build`
Expected: succeeds.

Manually, with `pnpm dev`: create a placeholder with two values in the tab; run the prompt from the playground with one selected; open Logs, select that run, click add-testcase-from-log, and confirm the created testcase shows the same `key: value` in the testcases table. Then rename the value and repeat — the toast must name the placeholder it could not transfer.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(placeholders): add the Placeholders tab and carry the selection from logs"
```

---

### Task 11: Migrate memory and delete it

Last, so that everything that reads placeholders already works. This is the only task that destroys data, and it runs after the reader is proven.

**Files:**
- Create: `apps/core/prisma/migrations/<timestamp>_migrate_memory_to_placeholders/migration.sql`
- Create: `apps/core/src/database/seed/report-placeholder-migration.ts`
- Modify: `apps/core/package.json` (a script for the report)
- Modify: `apps/core/prisma/models/prompt.prisma`, `apps/core/prisma/models/testcase.prisma`
- Delete: `apps/core/src/database/repositories/MemoriesRepository.ts`, `apps/core/src/services/validate/types/memory.type.ts`, the memory endpoints, `apps/web/src/pages/prompt/playground-tabs/memory/**`, `apps/web/src/query-keys/memory.keys.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: no `Memory` anywhere; a printed list of prompts whose productive commit lacks `{{memory_key}}`.

- [ ] **Step 1: Write the data migration**

Create the migration directory by hand and write `migration.sql`:

```sql
-- One placeholder named memory_key per prompt that owned memories.
INSERT INTO "Placeholder" ("key", "promptId", "createdAt", "updatedAt")
SELECT DISTINCT 'memory_key', m."promptId", NOW(), NOW()
FROM "Memory" m;

-- Every memory becomes one of its values. No value is marked default: today, not
-- passing memoryKey appends nothing, and a placeholder with no default renders
-- exactly that. A synthetic "none" value would pollute the selector and every log line.
INSERT INTO "PlaceholderValue" ("placeholderId", "name", "content", "isDefault", "createdAt", "updatedAt")
SELECT p."id", m."key", m."value", FALSE, NOW(), NOW()
FROM "Memory" m
JOIN "Placeholder" p ON p."promptId" = m."promptId" AND p."key" = 'memory_key';

-- Testcase selections carry over by name.
INSERT INTO "TestCasePlaceholderValue" ("testCaseId", "placeholderId", "placeholderValueId")
SELECT t."id", pv."placeholderId", pv."id"
FROM "TestCase" t
JOIN "Memory" m ON m."id" = t."memoryId"
JOIN "Placeholder" p ON p."promptId" = m."promptId" AND p."key" = 'memory_key'
JOIN "PlaceholderValue" pv ON pv."placeholderId" = p."id" AND pv."name" = m."key"
WHERE t."memoryId" IS NOT NULL;

-- Substitution is positional, so a prompt whose text has no {{memory_key}} would lose
-- its block. Prompt.value is the working DRAFT, not history: appending the marker here
-- restores exactly the old behaviour (memory was appended at the end anyway) and puts
-- it in front of the author, who can move or delete it. Committed versions are NOT
-- touched — that would be forging history — so production stays on the old commit
-- until the author decides to commit. See the report script for who that is.
UPDATE "Prompt"
SET "value" = "value" || E'\n\n{{memory_key}}'
WHERE "id" IN (SELECT DISTINCT "promptId" FROM "Memory")
  AND "value" NOT LIKE '%{{memory_key}}%';

ALTER TABLE "TestCase" DROP COLUMN "memoryId";
DROP TABLE "Memory";
```

Remove `model Memory` from `prompt.prisma`, `memories  Memory[]` from `Prompt`, and `memoryId` / `memory` from `TestCase` in `testcase.prisma`, so the schema matches what the SQL just did.

- [ ] **Step 2: Apply and regenerate**

```bash
pnpm --filter core db:migrate:dev
pnpm prisma:generate
```

- [ ] **Step 3: Write the report script**

`apps/core/src/database/seed/report-placeholder-migration.ts` prints every prompt that owns a `memory_key` placeholder whose **productive commit** (newest `PromptVersion` on branch `master`) does not contain `{{memory_key}}`:

```ts
import "dotenv/config";
import { prisma } from "@/database/prisma";

async function main() {
	const placeholders = await prisma.placeholder.findMany({
		where: { key: "memory_key" },
		include: { prompt: { select: { id: true, name: true, projectId: true } } },
	});

	const stale: string[] = [];
	for (const placeholder of placeholders) {
		const commit = await prisma.promptVersion.findFirst({
			where: { branch: { name: "master", promptId: placeholder.promptId } },
			orderBy: { id: "desc" },
		});
		if (commit && !commit.value.includes("{{memory_key}}")) {
			stale.push(
				`  prompt ${placeholder.prompt.id} "${placeholder.prompt.name}" (project ${placeholder.prompt.projectId})`,
			);
		}
	}

	if (stale.length === 0) {
		console.log("Every migrated prompt has {{memory_key}} in its productive commit.");
		return;
	}

	console.log(
		`${stale.length} prompt(s) run WITHOUT their memory block until re-committed:\n${stale.join("\n")}`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
```

Add to `apps/core/package.json`:

```json
"report:placeholder-migration": "dotenv -e ../../.env tsx src/database/seed/report-placeholder-migration.ts"
```

- [ ] **Step 4: Run the report and record its output**

Run: `pnpm --filter core report:placeholder-migration`
Expected: either the all-clear line, or a list. Paste the output into the PR description — it is the operational handover, and without it a silently missing instruction block is discovered through answer quality.

- [ ] **Step 5: Delete the memory code**

Remove: `MemoriesRepository.ts` and its `db.memories` field; `memory.type.ts` and its `export *`; `checkMemoryAccess`; the six memory methods on `PromptsController` (lines 301-366) and their routes (`PromptsRouter.ts:73-92`); `memoryId` from `PromptRunSchema`, `runPromptParams` and the testcase schemas; the memory branches in `testcase.controller.ts`; `apps/web/src/pages/prompt/playground-tabs/memory/**`; `apps/web/src/query-keys/memory.keys.ts`; the memory functions and types in `apps/web/src/api/prompt/prompt.api.ts`; the memory-draft helpers in `playground.store.ts`.

Leave alone: `LogDocument.memory_key`, `ClickHouseLogRow.memory_key`, the `memory_key` column in `init.sql` and its branch in `resolveLogPlaceholders`. Those serve rows already written and are the reason old logs still make testcases.

- [ ] **Step 6: Verify the whole tree**

Run: `pnpm --filter core type-check && pnpm --filter core test:run && pnpm --filter web build`
Expected: no new type errors; every test passes; web builds. `grep -rn "memories\|memoryId\|MemoryKey" apps/core/src apps/web/src` returns only the deliberate `memory_key` log survivors listed above.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(placeholders): migrate memory into placeholders and remove it"
```

---

## Self-review notes

Checked against the spec section by section: the package (decision 8) is Task 1; the data model and both constraints are Task 2; rendering rules 1-4 are Task 1 Step 6 and Task 4; "which definitions apply" is Task 5; the migration's four steps and the report are Task 11; logs are Task 6; testcases and add-from-log are Tasks 8 and 10; the public API and the `ignored` report are Task 7; both UI surfaces are Tasks 9 and 10; every test the spec lists has a home.

Two things the spec leaves implicit that this plan decides, both visible above: an unknown value **name** falls back to the default and is reported in `ignored` (Task 1, Step 6 — silently behaving like the default would hide caller error), and a malformed commit snapshot degrades to "no definitions" rather than throwing inside a paid run (Task 4, `parsePlaceholderSnapshot`).
