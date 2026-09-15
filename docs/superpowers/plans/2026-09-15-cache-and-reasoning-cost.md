# Cache and Reasoning Cost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bill cache-read, cache-write and reasoning tokens at the rates each vendor actually charges, record that split on every run, and show it in the UI.

**Architecture:** Each provider adapter normalizes its vendor's usage into one `TokenUsage` whose totals include their parts. `calculateCost` prices the parts from the code registry, which is the only home of cache prices. `logs` gains six columns, each a subset of an existing total. Every list of usage fields collapses into one typed `ZERO_USAGE`, so a field can no longer reach one code path and miss another.

**Tech Stack:** Node/Express/TypeScript, ClickHouse (append-only), React + Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-cache-and-reasoning-cost-design.md`. Read it before Task 1; D1–D9 are binding.

## Global Constraints

- **Totals include their parts (D2).** `prompt` includes `cacheRead` and `cacheWrite`; `completion` includes `reasoning`. No field, column or label anywhere means "uncached input" or "non-reasoning output".
- **Cache prices are absolute published USD per 1M tokens, in the code registry only (D1, D8).** Never computed as a fraction of the input price. Never a Prisma column. Values are exactly those in Task 2, retrieved 2026-09-15.
- **Do not change any base price or model id.** The discrepancies in the spec's Non-goals are a separate decision.
- **A missing cache price bills as the prompt price (D3).**
- **ClickHouse is append-only.** Nothing rewrites, backfills or deletes a row. Never edit an applied migration file; add a new one. Qualify every object with `{{DB_NAME}}`. One file, one logical change. Keep semicolons out of migration comments.
- **Do not modify the `log_id` expression.**
- **The UI never renders a zero part (D4, D7).**
- Never edit `apps/core/src/.generated/`.
- Run core tests through turbo: `pnpm turbo run test:run --filter=core`. Never `pnpm --filter core test:run`: it fails on a never-built tree.
- Type-check core with `pnpm turbo run type-check --filter=core`. Web tests: `pnpm turbo run test:run --filter=web`. Web type-check: `pnpm --filter web build`.
- Biome: tabs, indent width 4, line width 100, LF. No pre-commit hook runs: format the files you touch with `pnpm exec biome format --write <files>` from the repo root. Lint and format are red repo-wide; judge only the files you touch (see `.claude/skills/verifying-changes/`).
- Single `.env` at the repo root. A fresh worktree has none. Commands that read it (`clickhouse:*:dev`) need it copied from the main checkout to the worktree root. Never create one in a subfolder.
- A test that passes against the implementation it claims to exclude guards nothing. Where a step says the test must fail first, confirm that it does.

## Baseline

At `3e86412`, after `DATABASE_URL=postgresql://u:p@localhost:5432/db pnpm --filter core exec prisma generate`: core **944 tests / 82 files**, web **132 / 13**, both green.

A fresh worktree without that generate step fails 26 core files on import (`Cannot find package '@/prisma-types'`). That is not a regression. Both counts must only rise.

## File Structure

| File | Responsibility |
|---|---|
| `apps/core/src/ai/providers/index.ts` | `TokenUsage`, `RunCost`, `calculateCost` — the one formula |
| `apps/core/src/ai/providers/*/generate.ts` | Map one vendor's raw usage onto `TokenUsage` |
| `apps/core/src/ai/models/builder.ts` | `ListedPrices`; cache prices on `BuiltModel` |
| `apps/core/src/ai/models/vendors/*.ts` | The published prices, per model |
| `apps/core/src/ai/models/pricing.ts` | Registry lookup, price resolution with fallback, `withCachePrices` for display |
| `apps/core/src/services/logger/usage.ts` (new) | `ZERO_USAGE`, the single list of usage fields; `sumUsage` |
| `apps/core/src/services/logger/types.ts` | `LogUsage`; the ClickHouse list row type |
| `apps/core/clickhouse/migrations/20260915120000_logs_usage_split.sql` (new) | Six subset columns on `logs` |
| `apps/web/src/lib/usageDisplay.ts` (new) | Price formatting and the "only non-zero parts" rule, shared by three components |

---

## PR 1 — bill correctly, record the split

### Task 1: Normalize token usage across providers

**Files:**
- Modify: `apps/core/src/ai/providers/index.ts:44-56` (`ProviderResponse`)
- Modify: `apps/core/src/ai/providers/openai/generate.ts:48-58`
- Modify: `apps/core/src/ai/providers/anthropic/generate.ts:39-49`
- Modify: `apps/core/src/ai/providers/gemini/generate.ts:41-51`
- Modify: `apps/core/src/ai/providers/deepseek/generate.ts:61-73`
- Test: `apps/core/src/ai/providers/{openai,anthropic,gemini,deepseek}/generate.test.ts`
- Modify fixtures: `apps/core/src/ai/runner/run.test.ts` (`completion()`), `apps/core/src/services/logger/logger.test.ts` (`COMPLETION`)

**Interfaces:**
- Produces: `export type TokenUsage = { prompt: number; completion: number; total: number; cacheRead: number; cacheWrite: number; reasoning: number }` from `apps/core/src/ai/providers/index.ts`. `ProviderResponse.tokens: TokenUsage`.

- [ ] **Step 1: Write the failing adapter tests**

Append to `apps/core/src/ai/providers/openai/generate.test.ts` (reuses its `create`, `request()` and `functionCall()`):

```ts
describe("generateOpenAI usage normalization", () => {
	beforeEach(() => create.mockReset());

	it("reports cached input inside prompt and reasoning inside completion", async () => {
		create.mockResolvedValue({
			output: [functionCall("get_weather", '{"city":"Berlin"}', "call_1")],
			usage: {
				input_tokens: 1000,
				input_tokens_details: { cached_tokens: 800 },
				output_tokens: 300,
				output_tokens_details: { reasoning_tokens: 250 },
				total_tokens: 1300,
			},
		});

		const result = await generateOpenAI(request());

		expect(result.tokens).toEqual({
			prompt: 1000,
			completion: 300,
			total: 1300,
			cacheRead: 800,
			cacheWrite: 0,
			reasoning: 250,
		});
	});

	it("reports zeros, not NaN, when a compatible provider sends no usage", async () => {
		create.mockResolvedValue({
			output: [functionCall("get_weather", '{"city":"Berlin"}', "call_1")],
		});

		const result = await generateOpenAI(request());

		expect(result.tokens).toEqual({
			prompt: 0,
			completion: 0,
			total: 0,
			cacheRead: 0,
			cacheWrite: 0,
			reasoning: 0,
		});
	});
});
```

Append to `apps/core/src/ai/providers/anthropic/generate.test.ts`:

```ts
describe("generateAnthropic usage normalization", () => {
	beforeEach(() => create.mockReset());

	it("adds the cache tokens Anthropic reports beside input_tokens into prompt", async () => {
		create.mockResolvedValue({
			content: [{ type: "text", text: "It is 12°" }],
			usage: {
				input_tokens: 100,
				cache_read_input_tokens: 800,
				cache_creation_input_tokens: 50,
				output_tokens: 300,
			},
		});

		const result = await generateAnthropic(request());

		expect(result.tokens).toEqual({
			prompt: 950,
			completion: 300,
			total: 1250,
			cacheRead: 800,
			cacheWrite: 50,
			reasoning: 0,
		});
	});

	it("treats absent cache counts as zero", async () => {
		create.mockResolvedValue({
			content: [{ type: "text", text: "It is 12°" }],
			usage: { input_tokens: 1, output_tokens: 2 },
		});

		const result = await generateAnthropic(request());

		expect(result.tokens).toEqual({
			prompt: 1,
			completion: 2,
			total: 3,
			cacheRead: 0,
			cacheWrite: 0,
			reasoning: 0,
		});
	});
});
```

Append to `apps/core/src/ai/providers/gemini/generate.test.ts`:

```ts
describe("generateGemini usage normalization", () => {
	beforeEach(() => generateContent.mockReset());

	it("adds thoughts into completion and tool-use input into prompt", async () => {
		generateContent.mockResolvedValue({
			candidates: [{ content: { parts: [{ text: "It is 12°" }] } }],
			usageMetadata: {
				promptTokenCount: 1000,
				cachedContentTokenCount: 600,
				toolUsePromptTokenCount: 40,
				candidatesTokenCount: 200,
				thoughtsTokenCount: 500,
				totalTokenCount: 1740,
			},
		});

		const result = await generateGemini(request());

		expect(result.tokens).toEqual({
			prompt: 1040,
			completion: 700,
			total: 1740,
			cacheRead: 600,
			cacheWrite: 0,
			reasoning: 500,
		});
	});
});
```

Append to `apps/core/src/ai/providers/deepseek/generate.test.ts`:

```ts
describe("generateDeepSeek usage normalization", () => {
	beforeEach(() => create.mockReset());

	it("reads cache hits and reasoning out of their totals", async () => {
		create.mockResolvedValue({
			choices: [{ message: { content: "It is 12°" } }],
			usage: {
				prompt_tokens: 1000,
				prompt_cache_hit_tokens: 900,
				prompt_cache_miss_tokens: 100,
				completion_tokens: 400,
				completion_tokens_details: { reasoning_tokens: 350 },
				total_tokens: 1400,
			},
		});

		const result = await generateDeepSeek(request());

		expect(result.tokens).toEqual({
			prompt: 1000,
			completion: 400,
			total: 1400,
			cacheRead: 900,
			cacheWrite: 0,
			reasoning: 350,
		});
	});

	it("falls back to the OpenAI-shaped cached_tokens when hit tokens are absent", async () => {
		create.mockResolvedValue({
			choices: [{ message: { content: "It is 12°" } }],
			usage: {
				prompt_tokens: 1000,
				prompt_tokens_details: { cached_tokens: 700 },
				completion_tokens: 10,
				total_tokens: 1010,
			},
		});

		const result = await generateDeepSeek(request());

		expect(result.tokens.cacheRead).toBe(700);
		expect(result.tokens.reasoning).toBe(0);
	});
});
```

- [ ] **Step 2: Run them, watch them fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: the seven new tests FAIL (for example `expected { prompt: 1000, completion: 300, total: 1300 } to deeply equal { …, cacheRead: 800, … }`; the no-usage test gets `NaN`). Every other test passes.

- [ ] **Step 3: Implement**

In `apps/core/src/ai/providers/index.ts`, add above `ProviderResponse` and use it:

```ts
/**
 * A run's token usage, the same shape for every vendor. Totals include their parts, as the
 * OpenTelemetry GenAI conventions have it: a vendor that reports a part beside its total
 * rather than inside it has that part added in by its adapter.
 */
export type TokenUsage = {
	/** Every input token, cache read and cache write included. */
	prompt: number;
	/** Every output token, reasoning included. */
	completion: number;
	total: number;
	/** Input tokens served from the vendor's cache. A subset of `prompt`. */
	cacheRead: number;
	/** Input tokens written to the vendor's cache. A subset of `prompt`. */
	cacheWrite: number;
	/** Output tokens spent on reasoning. A subset of `completion`; 0 when the vendor does not report it. */
	reasoning: number;
};
```

and in `ProviderResponse` replace the inline `tokens: { prompt: number; completion: number; total: number; };` with `tokens: TokenUsage;`.

In `apps/core/src/ai/providers/openai/generate.ts`, before `const result`, add:

```ts
	const usage = response.usage;
	const prompt = usage?.input_tokens ?? 0;
	const completion = usage?.output_tokens ?? 0;
```

and replace the `tokens` block with:

```ts
		tokens: {
			prompt,
			completion,
			total: usage?.total_tokens ?? prompt + completion,
			cacheRead: usage?.input_tokens_details?.cached_tokens ?? 0,
			// OpenAI charges nothing to write its cache.
			cacheWrite: 0,
			reasoning: usage?.output_tokens_details?.reasoning_tokens ?? 0,
		},
```

In `apps/core/src/ai/providers/anthropic/generate.ts`, before `const r`, add:

```ts
	const { usage } = response;
	const cacheRead = usage.cache_read_input_tokens ?? 0;
	const cacheWrite = usage.cache_creation_input_tokens ?? 0;
	// Anthropic reports cache tokens beside input_tokens, not inside it.
	const prompt = usage.input_tokens + cacheRead + cacheWrite;
```

and replace the `tokens` block with:

```ts
		tokens: {
			prompt,
			completion: usage.output_tokens,
			total: prompt + usage.output_tokens,
			cacheRead,
			cacheWrite,
			// Anthropic's usage carries no reasoning count; thinking is billed inside output_tokens.
			reasoning: 0,
		},
```

In `apps/core/src/ai/providers/gemini/generate.ts`, before `const result`, add:

```ts
	const usage = response.usageMetadata;
	const reasoning = usage?.thoughtsTokenCount ?? 0;
	// Gemini reports thoughts beside candidatesTokenCount and tool-use input beside
	// promptTokenCount; totalTokenCount is the sum of all four.
	const prompt = (usage?.promptTokenCount ?? 0) + (usage?.toolUsePromptTokenCount ?? 0);
	const completion = (usage?.candidatesTokenCount ?? 0) + reasoning;
```

and replace the `tokens` block with:

```ts
		tokens: {
			prompt,
			completion,
			total: usage?.totalTokenCount ?? prompt + completion,
			cacheRead: usage?.cachedContentTokenCount ?? 0,
			// Implicit caching has no write fee; explicit caches are billed as storage.
			cacheWrite: 0,
			reasoning,
		},
```

In `apps/core/src/ai/providers/deepseek/generate.ts`, add the import and the local type at the top:

```ts
import type { CompletionUsage } from "openai/resources/completions";

/** DeepSeek extends OpenAI's usage with cache hit counts the SDK does not type. */
type DeepSeekUsage = CompletionUsage & { prompt_cache_hit_tokens?: number };
```

before `const result`, add:

```ts
	const usage = response.usage as DeepSeekUsage | undefined;
```

and replace the `tokens` block with:

```ts
		tokens: {
			prompt: usage?.prompt_tokens ?? 0,
			completion: usage?.completion_tokens ?? 0,
			total: usage?.total_tokens ?? 0,
			cacheRead:
				usage?.prompt_cache_hit_tokens ?? usage?.prompt_tokens_details?.cached_tokens ?? 0,
			// DeepSeek charges nothing to write its cache.
			cacheWrite: 0,
			reasoning: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
		},
```

- [ ] **Step 4: Give the test fixtures the new fields**

In `apps/core/src/ai/runner/run.test.ts`, inside `completion()`:

```ts
		tokens: { prompt: 10, completion: 5, total: 15, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
```

In `apps/core/src/services/logger/logger.test.ts`, in `COMPLETION`:

```ts
	tokens: { prompt: 10, completion: 20, total: 30, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
```

- [ ] **Step 5: Run tests and type-check**

Run: `pnpm turbo run test:run --filter=core` — Expected: all PASS, 951 tests.
Run: `pnpm turbo run type-check --filter=core` — Expected: clean. The four adapters are the only `ProviderResponse` literals in core.

- [ ] **Step 6: Format and commit**

```bash
pnpm exec biome format --write apps/core/src/ai/providers apps/core/src/ai/runner/run.test.ts apps/core/src/services/logger/logger.test.ts
git add apps/core/src/ai/providers apps/core/src/ai/runner/run.test.ts apps/core/src/services/logger/logger.test.ts
git commit -m "feat(providers): report cache and reasoning tokens inside their totals"
```

---

### Task 2: Cache prices in the registry, and their resolution

**Files:**
- Modify: `apps/core/src/ai/models/builder.ts:17-30, 32-43, 65-70, 120-133, 142`
- Modify: `apps/core/src/ai/models/pricing.ts` (whole file)
- Modify: `apps/core/src/ai/models/vendors/openai.ts`, `anthropic.ts`, `gemini.ts`, `deepseek.ts` (every `.pricing(` call)
- Modify: `apps/core/src/ai/runner/run.ts:249` (call site)
- Test: `apps/core/src/ai/models/pricing.test.ts` (rewrite the `getEffectivePrices` blocks, add two blocks)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces, from `apps/core/src/ai/models/builder.ts`:
  - `export type ListedPrices = { prompt: number; completion: number; cacheRead?: number; cacheWrite?: number }`
  - `PriceModifier = () => ListedPrices`
  - `BuiltModel.cacheReadPrice?: number`, `BuiltModel.cacheWritePrice?: number`
- Produces, from `apps/core/src/ai/models/pricing.ts`:
  - `export type Prices = { prompt: number; completion: number; cacheRead: number; cacheWrite: number }`
  - `export type PricedModel = { vendor: AiVendor; name: string; promptPrice: number; completionPrice: number }`
  - `export function findRegistryModel(vendor: AiVendor, name: string): BuiltModel | undefined`
  - `export function getEffectivePrices(model: PricedModel): Prices`
  - `export function withCachePrices<T extends { vendor: AiVendor; name: string }>(model: T): T & { cacheReadPrice: number | null; cacheWritePrice: number | null }`

- [ ] **Step 1: Rewrite the pricing tests**

In `apps/core/src/ai/models/pricing.test.ts`, change the imports to:

```ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { AiVendor } from "@/prisma";
import { getEffectivePrices, withCachePrices } from "./pricing";
import { ALL_MODELS, isDeepSeekPeak } from "./vendors";
```

add under `at()`:

```ts
function row(vendor: AiVendor, name: string, promptPrice: number, completionPrice: number) {
	return { vendor, name, promptPrice, completionPrice };
}
```

Keep the `isDeepSeekPeak` block as it is. Replace both `getEffectivePrices` describe blocks with:

```ts
	describe("getEffectivePrices", () => {
		it("bills DeepSeek at the peak rate during a peak window", () => {
			at(MONDAY, "02:30:00");

			expect(getEffectivePrices(row(AiVendor.DEEPSEEK, "deepseek-v4-pro", 1.32, 3.96))).toEqual({
				prompt: 1.32,
				completion: 3.96,
				cacheRead: 0.044,
				cacheWrite: 1.32,
			});
		});

		it("halves DeepSeek prices off-peak, cache hits included", () => {
			at(MONDAY, "18:00:00");

			expect(getEffectivePrices(row(AiVendor.DEEPSEEK, "deepseek-v4-pro", 1.32, 3.96))).toEqual({
				prompt: 0.66,
				completion: 1.98,
				cacheRead: 0.022,
				cacheWrite: 0.66,
			});
			expect(
				getEffectivePrices(row(AiVendor.DEEPSEEK, "deepseek-v4-flash", 0.44, 1.32)),
			).toEqual({ prompt: 0.22, completion: 0.66, cacheRead: 0.22, cacheWrite: 0.22 });
		});

		it("ignores the prices passed in for a model that carries a modifier", () => {
			at(MONDAY, "18:00:00");

			// Stale DB prices must not leak into the bill for a modifier-backed model.
			expect(getEffectivePrices(row(AiVendor.DEEPSEEK, "deepseek-v4-flash", 99, 99))).toEqual({
				prompt: 0.22,
				completion: 0.66,
				cacheRead: 0.22,
				cacheWrite: 0.22,
			});
		});
	});

	describe("getEffectivePrices for flat-priced models", () => {
		it("takes base prices from the row and the cache read price from the registry", () => {
			expect(getEffectivePrices(row(AiVendor.OPENAI, "gpt-4o", 2.5, 10))).toEqual({
				prompt: 2.5,
				completion: 10,
				cacheRead: 1.25,
				cacheWrite: 2.5,
			});
		});

		it("takes Anthropic's cache write price from the registry", () => {
			expect(getEffectivePrices(row(AiVendor.ANTHROPIC, "claude-sonnet-4-5", 3, 15))).toEqual({
				prompt: 3,
				completion: 15,
				cacheRead: 0.3,
				cacheWrite: 3.75,
			});
		});

		it("bills cache tokens at the prompt price where the vendor publishes no cache price", () => {
			expect(getEffectivePrices(row(AiVendor.OPENAI, "o3-pro", 20, 80))).toEqual({
				prompt: 20,
				completion: 80,
				cacheRead: 20,
				cacheWrite: 20,
			});
		});

		it("falls back to the row's prices for a model absent from the registry", () => {
			expect(
				getEffectivePrices(row(AiVendor.CUSTOM_OPENAI_COMPATIBLE, "some-custom-model", 1, 2)),
			).toEqual({ prompt: 1, completion: 2, cacheRead: 1, cacheWrite: 1 });
		});

		it("does not match a model name belonging to a different vendor", () => {
			expect(getEffectivePrices(row(AiVendor.ANTHROPIC, "deepseek-v4-flash", 7, 8))).toEqual({
				prompt: 7,
				completion: 8,
				cacheRead: 7,
				cacheWrite: 7,
			});
		});
	});
```

After the closing `});` of the top-level describe, add:

```ts
describe("registry cache prices", () => {
	it("lists every cache read below its own model's prompt price", () => {
		for (const model of ALL_MODELS) {
			if (model.cacheReadPrice !== undefined) {
				expect(model.cacheReadPrice, model.name).toBeLessThan(model.promptPrice);
			}
		}
	});

	it("lists every cache write at or above its own model's prompt price", () => {
		for (const model of ALL_MODELS) {
			if (model.cacheWritePrice !== undefined) {
				expect(model.cacheWritePrice, model.name).toBeGreaterThanOrEqual(model.promptPrice);
			}
		}
	});
});

describe("withCachePrices", () => {
	it("attaches the registry's cache prices and keeps every other field", () => {
		expect(withCachePrices({ id: 7, vendor: AiVendor.OPENAI, name: "gpt-4o" })).toEqual({
			id: 7,
			vendor: AiVendor.OPENAI,
			name: "gpt-4o",
			cacheReadPrice: 1.25,
			cacheWritePrice: null,
		});
	});

	it("attaches null, never zero, for a model absent from the registry", () => {
		expect(
			withCachePrices({ vendor: AiVendor.CUSTOM_OPENAI_COMPATIBLE, name: "some-custom-model" }),
		).toMatchObject({ cacheReadPrice: null, cacheWritePrice: null });
	});
});
```

- [ ] **Step 2: Run them, watch them fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: `pricing.test.ts` FAILS. `withCachePrices` is not exported, and `getEffectivePrices` returns no `cacheRead`.

- [ ] **Step 3: Implement the builder**

In `apps/core/src/ai/models/builder.ts`, replace the `PriceModifier` doc comment and type with:

```ts
/**
 * Prices as a vendor lists them, in USD per 1M tokens. A cache price is absent where the vendor
 * publishes none for the model; `getEffectivePrices` then bills those tokens as ordinary input.
 */
export type ListedPrices = {
	prompt: number;
	completion: number;
	cacheRead?: number;
	cacheWrite?: number;
};

/**
 * Returns the prices to bill a run at, at the moment it is called.
 * Lets a vendor express pricing that the static prices cannot — DeepSeek, for example,
 * halves every price outside its peak hours.
 * Code-side only: never seeded to the database.
 */
export type PriceModifier = () => ListedPrices;
```

Extend `BuiltModel`:

```ts
export type BuiltModel = SeedModelFields & {
	/** API parameters schema for validation (ModelConfig.parameters) */
	parameters: ModelParameters;
	/** Resolves the effective prices at call time. Absent for flat-priced models. */
	priceModifier?: PriceModifier;
	/**
	 * USD per 1M input tokens served from the vendor's cache. Code-side only, like
	 * `priceModifier`: `seed:prod` rewrites every registry model's stored prices from this file
	 * on each deploy, so a database copy would only be a mirror. Absent where none is published.
	 */
	cacheReadPrice?: number;
	/** USD per 1M input tokens written to the vendor's cache. Code-side only. */
	cacheWritePrice?: number;
};
```

Add `cacheReadPrice?: number;` and `cacheWritePrice?: number;` to `ModelBuilderState`. Replace the `pricing` method with:

```ts
		pricing(prices: ListedPrices, modifier?: PriceModifier) {
			state.promptPrice = prices.prompt;
			state.completionPrice = prices.completion;
			state.cacheReadPrice = prices.cacheRead;
			state.cacheWritePrice = prices.cacheWrite;
			state.priceModifier = modifier;
			return builder;
		},
```

In `build()`, after `priceModifier: state.priceModifier,` add:

```ts
				cacheReadPrice: state.cacheReadPrice,
				cacheWritePrice: state.cacheWritePrice,
```

In `interface ModelBuilder`:

```ts
	pricing(prices: ListedPrices, modifier?: PriceModifier): ModelBuilder;
```

Leave `SeedModelFields`, `toLanguageModelData` and `isModelDifferent` untouched. Cache prices are not seeded (D8).

- [ ] **Step 4: Implement the resolution**

Replace `apps/core/src/ai/models/pricing.ts` with:

```ts
import type { AiVendor } from "@/prisma";
import type { BuiltModel, ListedPrices } from "./builder";
import { ALL_MODELS } from "./vendors";

/**
 * The prices one run is billed at, in USD per 1M tokens. Unlike `ListedPrices`, nothing here is
 * optional: a cache price the vendor does not publish has already fallen back to the prompt
 * price, so a cached token is never billed below what it was before cache prices existed.
 */
export type Prices = { prompt: number; completion: number; cacheRead: number; cacheWrite: number };

/** The fields of a `LanguageModel` row that pricing reads. */
export type PricedModel = {
	vendor: AiVendor;
	name: string;
	promptPrice: number;
	completionPrice: number;
};

export function findRegistryModel(vendor: AiVendor, name: string): BuiltModel | undefined {
	return ALL_MODELS.find((m) => m.name === name && m.vendor === vendor);
}

function resolve(listed: ListedPrices): Prices {
	return {
		prompt: listed.prompt,
		completion: listed.completion,
		cacheRead: listed.cacheRead ?? listed.prompt,
		cacheWrite: listed.cacheWrite ?? listed.prompt,
	};
}

/**
 * Resolves the prices a run should be billed at, in USD per 1M tokens.
 *
 * Base prices come from the model row, which the registry sync keeps equal to the registry for
 * every registry model. Cache prices come from the registry alone — they are code-side only.
 * A model whose registry entry declares a `priceModifier` resolves all of its prices at call
 * time instead: DeepSeek halves them outside its peak hours.
 *
 * Models absent from the registry (custom OpenAI-compatible providers, models seeded by an
 * older release) bill at the row's prices, with cache tokens at the prompt price.
 */
export function getEffectivePrices(model: PricedModel): Prices {
	const registered = findRegistryModel(model.vendor, model.name);

	if (registered?.priceModifier) {
		return resolve(registered.priceModifier());
	}

	return resolve({
		prompt: model.promptPrice,
		completion: model.completionPrice,
		cacheRead: registered?.cacheReadPrice,
		cacheWrite: registered?.cacheWritePrice,
	});
}

/**
 * A model row with the cache prices the registry lists, for display. `null` where none is
 * listed, which a reader shows as "no cache price", never as free.
 */
export function withCachePrices<T extends { vendor: AiVendor; name: string }>(
	model: T,
): T & { cacheReadPrice: number | null; cacheWritePrice: number | null } {
	const registered = findRegistryModel(model.vendor, model.name);

	return {
		...model,
		cacheReadPrice: registered?.cacheReadPrice ?? null,
		cacheWritePrice: registered?.cacheWritePrice ?? null,
	};
}
```

In `apps/core/src/ai/runner/run.ts`, change the call to:

```ts
			getEffectivePrices(model),
```

- [ ] **Step 5: Enter the published prices**

Every `.pricing(a, b)` becomes an object. Match each model by the name in its `model("…")` call. These are the official pages on 2026-09-15. Base prices are unchanged; a model with no `cacheRead` gets none on purpose (spec, "Prices").

`apps/core/src/ai/models/vendors/openai.ts`:

```ts
// gpt-4o
.pricing({ prompt: 2.5, completion: 10, cacheRead: 1.25 })
// gpt-4o-mini
.pricing({ prompt: 0.15, completion: 0.6, cacheRead: 0.075 })
// gpt-4.1
.pricing({ prompt: 2, completion: 8, cacheRead: 0.5 })
// gpt-4.1-nano
.pricing({ prompt: 0.1, completion: 0.4, cacheRead: 0.025 })
// gpt-4.1-mini
.pricing({ prompt: 0.4, completion: 1.6, cacheRead: 0.1 })
// o3
.pricing({ prompt: 2, completion: 8, cacheRead: 0.5 })
// o3-pro — no cached price published
.pricing({ prompt: 20, completion: 80 })
// o3-mini
.pricing({ prompt: 1.1, completion: 4.4, cacheRead: 0.55 })
// o4-mini
.pricing({ prompt: 1.1, completion: 4.4, cacheRead: 0.275 })
// gpt-5
.pricing({ prompt: 1.25, completion: 10, cacheRead: 0.125 })
// gpt-5-mini
.pricing({ prompt: 0.25, completion: 2, cacheRead: 0.025 })
// gpt-5-nano
.pricing({ prompt: 0.05, completion: 0.4, cacheRead: 0.005 })
// gpt-5-pro — no cached price published
.pricing({ prompt: 15, completion: 120 })
// gpt-5.1
.pricing({ prompt: 1.25, completion: 10, cacheRead: 0.125 })
// gpt-5.2
.pricing({ prompt: 1.75, completion: 14, cacheRead: 0.175 })
// gpt-5.4
.pricing({ prompt: 2.5, completion: 15, cacheRead: 0.25 })
// gpt-5.4-mini
.pricing({ prompt: 0.75, completion: 4.5, cacheRead: 0.075 })
// gpt-5.4-nano
.pricing({ prompt: 0.2, completion: 1.25, cacheRead: 0.02 })
// gpt-5.5
.pricing({ prompt: 5, completion: 30, cacheRead: 0.5 })
// gpt-5.5-pro — no cached price published
.pricing({ prompt: 30, completion: 180 })
// gpt-5.6-sol — base price disagrees with OpenAI's promotional price; no cache price here
.pricing({ prompt: 5, completion: 30 })
// gpt-5.6-terra
.pricing({ prompt: 2, completion: 12, cacheRead: 0.2 })
// gpt-5.6-luna
.pricing({ prompt: 0.2, completion: 1.2, cacheRead: 0.02 })
```

`apps/core/src/ai/models/vendors/anthropic.ts`:

```ts
// claude-3-7-sonnet-latest — no longer on Anthropic's pricing page
.pricing({ prompt: 3, completion: 15 })
// claude-sonnet-4-0
.pricing({ prompt: 3, completion: 15, cacheRead: 0.3, cacheWrite: 3.75 })
// claude-sonnet-4-5
.pricing({ prompt: 3, completion: 15, cacheRead: 0.3, cacheWrite: 3.75 })
// claude-haiku-4-5
.pricing({ prompt: 1, completion: 5, cacheRead: 0.1, cacheWrite: 1.25 })
// claude-sonnet-4-6
.pricing({ prompt: 3, completion: 15, cacheRead: 0.3, cacheWrite: 3.75 })
// claude-opus-4-7
.pricing({ prompt: 5, completion: 25, cacheRead: 0.5, cacheWrite: 6.25 })
```

`apps/core/src/ai/models/vendors/gemini.ts` (text-input caching price, prompts of 200k tokens or fewer):

```ts
// gemini-2.0-flash — no longer on Google's pricing page
.pricing({ prompt: 0.1, completion: 0.7 })
// gemini-2.0-flash-lite — no longer on Google's pricing page
.pricing({ prompt: 0.075, completion: 0.3 })
// gemini-2.5-flash
.pricing({ prompt: 0.3, completion: 2.5, cacheRead: 0.03 })
// gemini-2.5-pro
.pricing({ prompt: 1.25, completion: 10, cacheRead: 0.125 })
// gemini-2.5-flash-lite
.pricing({ prompt: 0.1, completion: 0.4, cacheRead: 0.01 })
// gemini-3-pro-preview — no longer on Google's pricing page
.pricing({ prompt: 2, completion: 12 })
// gemini-3-flash-preview
.pricing({ prompt: 0.5, completion: 3, cacheRead: 0.05 })
// gemini-3.1-flash-lite
.pricing({ prompt: 0.25, completion: 1.5, cacheRead: 0.025 })
// gemini-3.1-pro-preview
.pricing({ prompt: 2, completion: 12, cacheRead: 0.2 })
```

`apps/core/src/ai/models/vendors/deepseek.ts`:
- Change the builder import to `import type { BuiltModel, ListedPrices, PriceModifier } from "../builder";`.
- Delete `import type { Prices } from "../pricing";`.
- Change the signature to `function timeOfDayPricing(peak: ListedPrices, offPeak: ListedPrices): PriceModifier`.
- Replace the two `.pricing(...)` calls:

```ts
	// deepseek-v4-flash — base price disagrees with DeepSeek's page; no cache price here
		.pricing(
			{ prompt: 0.44, completion: 1.32 },
			timeOfDayPricing({ prompt: 0.44, completion: 1.32 }, { prompt: 0.22, completion: 0.66 }),
		)
	// deepseek-v4-pro
		.pricing(
			{ prompt: 1.32, completion: 3.96, cacheRead: 0.044 },
			timeOfDayPricing(
				{ prompt: 1.32, completion: 3.96, cacheRead: 0.044 },
				{ prompt: 0.66, completion: 1.98, cacheRead: 0.022 },
			),
		)
```

The `// model-name` lines above are for matching only. Do not paste them into the registry.

- [ ] **Step 6: Run tests and type-check**

Run: `pnpm turbo run test:run --filter=core` — Expected: all PASS.
Run: `pnpm turbo run type-check --filter=core` — Expected: clean. A `.pricing` call you missed is a type error: two positional numbers no longer match `ListedPrices`.

- [ ] **Step 7: Format and commit**

```bash
pnpm exec biome format --write apps/core/src/ai/models apps/core/src/ai/runner/run.ts
git add apps/core/src/ai/models apps/core/src/ai/runner/run.ts
git commit -m "feat(pricing): published cache prices in the model registry"
```

---

### Task 3: Split the cost

**Files:**
- Modify: `apps/core/src/ai/providers/index.ts` (`calculateCost`)
- Modify: `apps/core/src/ai/runner/run.ts:242-250`
- Create test: `apps/core/src/ai/providers/index.test.ts`

**Interfaces:**
- Consumes: `TokenUsage` (Task 1); `Prices`, `getEffectivePrices(model)` (Task 2).
- Produces: `export type RunCost = { prompt: number; completion: number; total: number; cacheRead: number; cacheWrite: number; reasoning: number }` and `export function calculateCost(tokens: TokenUsage, prices: Prices): RunCost` from `apps/core/src/ai/providers/index.ts`.

- [ ] **Step 1: Write the failing test**

Create `apps/core/src/ai/providers/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calculateCost, type TokenUsage } from ".";

const PRICES = { prompt: 2, completion: 8, cacheRead: 0.5, cacheWrite: 2.5 };

function usage(overrides: Partial<TokenUsage> = {}): TokenUsage {
	return {
		prompt: 0,
		completion: 0,
		total: 0,
		cacheRead: 0,
		cacheWrite: 0,
		reasoning: 0,
		...overrides,
	};
}

describe("calculateCost", () => {
	it("bills cached input at the cache price and only the rest at the prompt price", () => {
		const cost = calculateCost(usage({ prompt: 1_000_000, cacheRead: 800_000 }), PRICES);

		expect(cost.cacheRead).toBeCloseTo(0.4);
		// 200k × $2 + 800k × $0.50
		expect(cost.prompt).toBeCloseTo(0.8);
	});

	it("bills cache writes at the cache write price", () => {
		const cost = calculateCost(usage({ prompt: 1_000_000, cacheWrite: 1_000_000 }), PRICES);

		expect(cost.cacheWrite).toBeCloseTo(2.5);
		expect(cost.prompt).toBeCloseTo(2.5);
	});

	it("reports reasoning as a share of completion, never on top of it", () => {
		const cost = calculateCost(usage({ completion: 1_000_000, reasoning: 750_000 }), PRICES);

		expect(cost.completion).toBeCloseTo(8);
		expect(cost.reasoning).toBeCloseTo(6);
		expect(cost.total).toBeCloseTo(8);
	});

	it("totals prompt and completion", () => {
		const cost = calculateCost(
			usage({ prompt: 500_000, cacheRead: 100_000, completion: 250_000 }),
			PRICES,
		);

		// 400k × $2 + 100k × $0.50 + 250k × $8
		expect(cost.total).toBeCloseTo(0.8 + 0.05 + 2);
		expect(cost.total).toBeCloseTo(cost.prompt + cost.completion);
	});

	it("never goes negative when a vendor reports more cache tokens than input tokens", () => {
		const cost = calculateCost(usage({ prompt: 100, cacheRead: 500 }), PRICES);

		expect(cost.prompt).toBeGreaterThanOrEqual(0);
		expect(cost.prompt).toBeCloseTo(cost.cacheRead);
	});
});
```

- [ ] **Step 2: Run it, watch it fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: `index.test.ts` FAILS. `cost.cacheRead` is `undefined`, and the current formula bills all 1M input tokens at $2.

- [ ] **Step 3: Implement**

In `apps/core/src/ai/providers/index.ts`, add `import type { Prices } from "../models/pricing";` to the imports. It is a type-only import, so it creates no runtime cycle. Replace `calculateCost` with:

```ts
/** USD for one run. `prompt` includes both cache parts and `completion` includes `reasoning`. */
export type RunCost = {
	prompt: number;
	completion: number;
	total: number;
	cacheRead: number;
	cacheWrite: number;
	reasoning: number;
};

const TOKENS_PER_UNIT = 1_000_000;

export function calculateCost(tokens: TokenUsage, prices: Prices): RunCost {
	// Clamped: a vendor that reports more cache tokens than input tokens must not produce a
	// negative cost.
	const uncached = Math.max(0, tokens.prompt - tokens.cacheRead - tokens.cacheWrite);
	const cacheRead = (tokens.cacheRead / TOKENS_PER_UNIT) * prices.cacheRead;
	const cacheWrite = (tokens.cacheWrite / TOKENS_PER_UNIT) * prices.cacheWrite;
	const prompt = (uncached / TOKENS_PER_UNIT) * prices.prompt + cacheRead + cacheWrite;
	const completion = (tokens.completion / TOKENS_PER_UNIT) * prices.completion;
	// Every vendor bills reasoning at the output rate: this is its share, not an extra charge.
	const reasoning = (tokens.reasoning / TOKENS_PER_UNIT) * prices.completion;

	return { prompt, completion, total: prompt + completion, cacheRead, cacheWrite, reasoning };
}
```

In `apps/core/src/ai/runner/run.ts`, replace the `calculateCost(...)` call with:

```ts
		const cost = calculateCost(
			completion.tokens,
			// Most models bill at the price stored on the model; some (DeepSeek) vary it by
			// time of day, so resolve the effective price at the moment the run is billed.
			getEffectivePrices(model),
		);
```

- [ ] **Step 4: Run tests and type-check**

Run: `pnpm turbo run test:run --filter=core` — Expected: all PASS.
Run: `pnpm turbo run type-check --filter=core` — Expected: clean.

- [ ] **Step 5: Format and commit**

```bash
pnpm exec biome format --write apps/core/src/ai/providers/index.ts apps/core/src/ai/providers/index.test.ts apps/core/src/ai/runner/run.ts
git add apps/core/src/ai/providers/index.ts apps/core/src/ai/providers/index.test.ts apps/core/src/ai/runner/run.ts
git commit -m "feat(cost): bill cache reads, cache writes and reasoning at their own rates"
```

---

### Task 4: One list of usage fields

A refactor with no behaviour change. It prepares Task 5, where adding a usage field becomes a type error at every place that must handle it.

**Files:**
- Modify: `apps/core/src/services/logger/types.ts:61-96` (`LogDocument`)
- Create: `apps/core/src/services/logger/usage.ts`
- Create test: `apps/core/src/services/logger/usage.test.ts`
- Modify: `apps/core/src/controllers/testcase.controller.ts:477-493` (`logTrajectoryRun`)
- Modify: `apps/core/src/ai/runner/run.ts:303-325` (error row), `:366-384` (transcription row)
- Modify: `apps/core/src/controllers/otlp.controller.ts:163-188`

**Interfaces:**
- Produces, from `apps/core/src/services/logger/types.ts`: `export interface LogUsage { tokens_in; tokens_out; tokens_sum; cost; response_ms }`, all `number`. `LogDocument extends LogUsage`.
- Produces, from `apps/core/src/services/logger/usage.ts`:
  - `export const ZERO_USAGE: Readonly<LogUsage>`
  - `export function sumUsage(turns: readonly LogUsage[]): LogUsage`

- [ ] **Step 1: Write the failing test**

Create `apps/core/src/services/logger/usage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { QUERIES } from "./queries";
import type { LogUsage } from "./types";
import { sumUsage, ZERO_USAGE } from "./usage";

const FIELDS = Object.keys(ZERO_USAGE) as (keyof LogUsage)[];

/**
 * Distinct and non-zero for every field and every turn, so a field copied from one turn
 * instead of summed can never equal the expected sum.
 */
function turn(seed: number): LogUsage {
	const usage: LogUsage = { ...ZERO_USAGE };
	FIELDS.forEach((field, index) => {
		usage[field] = seed * (index + 1);
	});
	return usage;
}

describe("sumUsage", () => {
	it("sums every usage field across the turns", () => {
		const total = sumUsage([turn(1), turn(10), turn(100)]);

		FIELDS.forEach((field, index) => {
			expect(total[field], field).toBe(111 * (index + 1));
		});
	});

	it("is zero usage for no turns", () => {
		expect(sumUsage([])).toEqual(ZERO_USAGE);
	});
});

describe("LOG_LIST_COLUMNS", () => {
	// Its type cannot catch this: a field in the row type but not in the query is `undefined`
	// at runtime, not a type error (see ClickHouseLogListRow).
	it("names every usage field", () => {
		for (const field of FIELDS) {
			expect(QUERIES.LOG_LIST_COLUMNS).toMatch(new RegExp(`\\b${field}\\b`));
		}
	});
});
```

- [ ] **Step 2: Run it, watch it fail**

Run: `pnpm turbo run test:run --filter=core`
Expected: `usage.test.ts` FAILS with `Failed to resolve import "./usage"`.

- [ ] **Step 3: Implement**

In `apps/core/src/services/logger/types.ts`, add above `LogDocument`:

```ts
/**
 * The usage half of a log row: every field a trajectory's root row must SUM across its turns
 * rather than copy from the last one. `ZERO_USAGE` in `usage.ts` is the one place these fields
 * are listed.
 */
export interface LogUsage {
	tokens_in: number;
	tokens_out: number;
	tokens_sum: number;
	cost: number;
	/** Summed too, deliberately -- see `logTrajectoryRun`. */
	response_ms: number;
}
```

Change `export interface LogDocument {` to `export interface LogDocument extends LogUsage {`. Under `// AI info`, delete `tokens_in`, `tokens_out`, `tokens_sum`, `cost` and `response_ms`, and keep `vendor` and `model`.

Create `apps/core/src/services/logger/usage.ts`:

```ts
import type { LogUsage } from "./types";

/**
 * A row with no usage: an error, a transcription, an ingested trace.
 *
 * Also the ONE list of usage fields. A fresh literal typed `LogUsage` fails type-check on a
 * missing field and on an extra one, and `sumUsage` sums exactly its keys. What that guards
 * against is a usage field reaching a trajectory's root row with the last turn's value instead
 * of the sum -- silently, and invisibly to any single-turn test.
 */
export const ZERO_USAGE: Readonly<LogUsage> = {
	tokens_in: 0,
	tokens_out: 0,
	tokens_sum: 0,
	cost: 0,
	response_ms: 0,
};

const USAGE_FIELDS = Object.keys(ZERO_USAGE) as (keyof LogUsage)[];

/** Sums every usage field across a trajectory's turns. */
export function sumUsage(turns: readonly LogUsage[]): LogUsage {
	const total: LogUsage = { ...ZERO_USAGE };

	for (const field of USAGE_FIELDS) {
		total[field] = turns.reduce((sum, turn) => sum + turn[field], 0);
	}

	return total;
}
```

In `apps/core/src/controllers/testcase.controller.ts`, add `import { sumUsage } from "@/services/logger/usage";`. In `logTrajectoryRun`, replace the five `turns.reduce(...)` lines (`tokens_in` through `response_ms`) with:

```ts
		...sumUsage(turns),
```

In `apps/core/src/ai/runner/run.ts`, add `import { ZERO_USAGE } from "@/services/logger/usage";`. In both the `AIError` row inside `catch` and the `transcribe` row, replace the five lines `tokens_in: 0,` through `response_ms: 0,` with:

```ts
			...ZERO_USAGE,
```

In `apps/core/src/controllers/otlp.controller.ts`, add the same import and replace the same five lines of the `TraceIngested` row with `...ZERO_USAGE,`.

- [ ] **Step 4: Run tests and type-check**

Run: `pnpm turbo run test:run --filter=core` — Expected: all PASS, including the existing `testcase.controller.test.ts` "writes one root log row…" (30 / 7 / 37 / 1 / 400) and `otlp.controller.test.ts` "writes zero usage…".
Run: `pnpm turbo run type-check --filter=core` — Expected: clean.

- [ ] **Step 5: Format and commit**

```bash
pnpm exec biome format --write apps/core/src/services/logger/types.ts apps/core/src/services/logger/usage.ts apps/core/src/services/logger/usage.test.ts apps/core/src/controllers/testcase.controller.ts apps/core/src/controllers/otlp.controller.ts apps/core/src/ai/runner/run.ts
git add apps/core/src/services/logger apps/core/src/controllers/testcase.controller.ts apps/core/src/controllers/otlp.controller.ts apps/core/src/ai/runner/run.ts
git commit -m "refactor(logger): one list of usage fields, summed by sumUsage"
```

---

### Task 5: Record the split in logs

**Files:**
- Create: `apps/core/clickhouse/migrations/20260915120000_logs_usage_split.sql`
- Modify: `apps/core/src/services/logger/types.ts` (`LogUsage`, `ClickHouseLogListRow`)
- Modify: `apps/core/src/services/logger/usage.ts` (`ZERO_USAGE`)
- Modify: `apps/core/src/services/logger/logger.ts:172-195` (`transformRowToLogListEntry`), `:216-249` (insert)
- Modify: `apps/core/src/services/logger/queries.ts:57-78` (`LOG_LIST_COLUMNS`)
- Modify: `apps/core/src/ai/runner/run.ts:256-277` (success row)
- Test: `apps/core/src/services/logger/logger.test.ts`, `apps/core/src/controllers/testcase.controller.test.ts`

**Interfaces:**
- Consumes: `RunCost` (Task 3); `LogUsage`, `ZERO_USAGE`, `sumUsage` (Task 4).
- Produces: six new `LogUsage` fields — `tokens_in_cache_read`, `tokens_in_cache_write`, `tokens_out_reasoning`, `cost_in_cache_read`, `cost_in_cache_write`, `cost_out_reasoning` (all `number`), and the same six ClickHouse columns, which PR 2 reads.

- [ ] **Step 1: Write the failing tests**

In `apps/core/src/controllers/testcase.controller.test.ts`, inside `modelTurn`'s document, after `response_ms: 100,`, add:

```ts
				tokens_in_cache_read: 0,
				tokens_in_cache_write: 0,
				tokens_out_reasoning: 0,
				cost_in_cache_read: 0,
				cost_in_cache_write: 0,
				cost_out_reasoning: 0,
```

After the test "writes one root log row and one span batch, correlated by trace_id", add:

```ts
	it("sums the usage split across the turns instead of keeping the last turn's", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(makeTrajectoryTestcase());
		modelTurn(
			{ answer: "", toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Berlin" } }] },
			{
				tokens_in_cache_read: 800,
				tokens_out_reasoning: 40,
				cost_in_cache_read: 0.001,
				cost_out_reasoning: 0.004,
			},
		);
		modelTurn(
			{ answer: "It is 12°" },
			{
				tokens_in_cache_read: 900,
				tokens_out_reasoning: 10,
				cost_in_cache_read: 0.002,
				cost_out_reasoning: 0.001,
			},
		);
		const { res } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		const root = vi.mocked(logUsage).mock.calls[0][0];
		expect(root.tokens_in_cache_read).toBe(1700);
		expect(root.tokens_out_reasoning).toBe(50);
		expect(root.cost_in_cache_read).toBeCloseTo(0.003);
		expect(root.cost_out_reasoning).toBeCloseTo(0.005);
	});
```

In `apps/core/src/services/logger/logger.test.ts`, add to `DOCUMENT` after `response_ms: 640,`:

```ts
	tokens_in_cache_read: 6,
	tokens_in_cache_write: 1,
	tokens_out_reasoning: 12,
	cost_in_cache_read: 0.00001,
	cost_in_cache_write: 0.000002,
	cost_out_reasoning: 0.0003,
```

Inside `describe("logUsage")`, add:

```ts
	it("writes the usage split alongside the totals it is part of", async () => {
		await logUsage(DOCUMENT);

		expect(clickhouse.insert.mock.calls[0][0].values[0]).toMatchObject({
			tokens_in_cache_read: 6,
			tokens_in_cache_write: 1,
			tokens_out_reasoning: 12,
			cost_in_cache_read: 0.00001,
			cost_in_cache_write: 0.000002,
			cost_out_reasoning: 0.0003,
		});
	});
```

Inside `describe("runPrompt analytics")`, add:

```ts
	it("records the split of the run's usage and what each part cost", async () => {
		(generateOpenAI as Mock).mockResolvedValue({
			...COMPLETION,
			tokens: {
				prompt: 1_000_000,
				completion: 100_000,
				total: 1_100_000,
				cacheRead: 800_000,
				cacheWrite: 0,
				reasoning: 60_000,
			},
		});

		await runPrompt(runParams());

		const row = clickhouse.insert.mock.calls[0][0].values[0];
		expect(row).toMatchObject({
			tokens_in: 1_000_000,
			tokens_in_cache_read: 800_000,
			tokens_in_cache_write: 0,
			tokens_out_reasoning: 60_000,
		});
		// gpt-4o: $2.50 input and $10 output from MODEL, $1.25 cached input from the registry.
		expect(row.cost_in_cache_read).toBeCloseTo(1);
		expect(row.cost_out_reasoning).toBeCloseTo(0.6);
		// 200k × $2.50 + 800k × $1.25 + 100k × $10
		expect(row.cost).toBeCloseTo(2.5);
	});
```

- [ ] **Step 2: Run them, watch them fail**

Run: `pnpm turbo run test:run --filter=core`
Expected FAIL:
- "sums the usage split…" gets `900` instead of `1700`. This is the defect: `sumUsage` does not know the field yet, so `...base` (the last turn) supplies it.
- "writes the usage split…" and "records the split…" fail because the insert omits the columns.
- `usage.test.ts` still passes: the fields are not in `ZERO_USAGE` yet.

- [ ] **Step 3: Write the migration**

Create `apps/core/clickhouse/migrations/20260915120000_logs_usage_split.sql`:

```sql
-- The split of a run's usage: how much of its input the vendor served from or wrote to its
-- cache, how much of its output was reasoning, and what each of those cost.
--
-- Recorded at write time because it exists nowhere else. The counts are in the vendor's
-- response to that one call, and the costs depend on the prices in force when the run was
-- billed (DeepSeek's change by the hour). Neither can be derived later.
--
-- Every column is a SUBSET of a column that already exists (tokens_in, tokens_out or cost),
-- never a new total. So every sum(tokens_in) and sum(cost) in queries.ts keeps its meaning,
-- and a zero reads the same on every row: nothing to show. A row written before this
-- migration recorded no split, and a new row without a cache has none.
--
-- log_id is not touched. It hashes a fixed list of columns that does not include these.
ALTER TABLE {{DB_NAME}}.logs
    ADD COLUMN IF NOT EXISTS tokens_in_cache_read UInt32 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tokens_in_cache_write UInt32 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tokens_out_reasoning UInt32 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_in_cache_read Float64 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_in_cache_write Float64 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_out_reasoning Float64 DEFAULT 0;
```

- [ ] **Step 4: Add the fields**

In `apps/core/src/services/logger/types.ts`, append to `LogUsage` after `response_ms`:

```ts
	/** Input tokens the vendor served from its cache. A subset of `tokens_in`. */
	tokens_in_cache_read: number;
	/** Input tokens the vendor wrote to its cache. A subset of `tokens_in`. */
	tokens_in_cache_write: number;
	/** Output tokens spent on reasoning. A subset of `tokens_out`; 0 when the vendor does not report it. */
	tokens_out_reasoning: number;
	/** What `tokens_in_cache_read` cost. A part of `cost`. */
	cost_in_cache_read: number;
	/** What `tokens_in_cache_write` cost. A part of `cost`. */
	cost_in_cache_write: number;
	/** What `tokens_out_reasoning` cost, at the output price. A part of `cost`. */
	cost_out_reasoning: number;
```

Append the same six names, each `: number;`, to `ClickHouseLogListRow` after `response_ms: number;`.

Run `pnpm turbo run type-check --filter=core` now. It must report `ZERO_USAGE` (missing properties), the success row in `run.ts`, and `transformRowToLogListEntry`. That is D5 working. It may also report a test fixture typed `LogDocument` or `LogListEntry` that this plan does not name; give such a fixture the six fields as `0`. Fix the three places:

In `apps/core/src/services/logger/usage.ts`, append to `ZERO_USAGE`:

```ts
	tokens_in_cache_read: 0,
	tokens_in_cache_write: 0,
	tokens_out_reasoning: 0,
	cost_in_cache_read: 0,
	cost_in_cache_write: 0,
	cost_out_reasoning: 0,
```

In `apps/core/src/ai/runner/run.ts`, in the success `usage` row after `response_ms: completion.response_time_ms,`:

```ts
			tokens_in_cache_read: completion.tokens.cacheRead,
			tokens_in_cache_write: completion.tokens.cacheWrite,
			tokens_out_reasoning: completion.tokens.reasoning,
			cost_in_cache_read: cost.cacheRead,
			cost_in_cache_write: cost.cacheWrite,
			cost_out_reasoning: cost.reasoning,
```

In `apps/core/src/services/logger/logger.ts`, in `transformRowToLogListEntry` after `response_ms: row.response_ms,`:

```ts
		tokens_in_cache_read: row.tokens_in_cache_read,
		tokens_in_cache_write: row.tokens_in_cache_write,
		tokens_out_reasoning: row.tokens_out_reasoning,
		cost_in_cache_read: row.cost_in_cache_read,
		cost_in_cache_write: row.cost_in_cache_write,
		cost_out_reasoning: row.cost_out_reasoning,
```

The insert is not type-checked against the table. Add after `response_ms: document.response_ms,`:

```ts
					tokens_in_cache_read: document.tokens_in_cache_read,
					tokens_in_cache_write: document.tokens_in_cache_write,
					tokens_out_reasoning: document.tokens_out_reasoning,
					cost_in_cache_read: document.cost_in_cache_read,
					cost_in_cache_write: document.cost_in_cache_write,
					cost_out_reasoning: document.cost_out_reasoning,
```

In `apps/core/src/services/logger/queries.ts`, in `LOG_LIST_COLUMNS`, between `cost,` and `response_ms`:

```
		tokens_in_cache_read,
		tokens_in_cache_write,
		tokens_out_reasoning,
		cost_in_cache_read,
		cost_in_cache_write,
		cost_out_reasoning,
```

- [ ] **Step 5: Run tests and type-check**

Run: `pnpm turbo run test:run --filter=core`
Expected: all PASS — the three new tests, and `usage.test.ts`, which now also checks the six fields against `LOG_LIST_COLUMNS`.

Run: `pnpm turbo run type-check --filter=core` — Expected: clean.

- [ ] **Step 6: Apply the migration on dev**

With dev infra up (`docker-compose -f docker-compose.dev.yml up -d`) and the root `.env` in the worktree:

```bash
pnpm --filter core clickhouse:migrate:dev
pnpm --filter core clickhouse:status:dev
```

Expected: `20260915120000_logs_usage_split` applied, and status reports nothing pending or drifted. If dev ClickHouse is unavailable, say so in the PR's Verification section. Never claim the migration was applied when it was not.

- [ ] **Step 7: Format and commit**

```bash
pnpm exec biome format --write apps/core/src/services/logger apps/core/src/ai/runner/run.ts apps/core/src/controllers/testcase.controller.test.ts
git add apps/core/clickhouse/migrations/20260915120000_logs_usage_split.sql apps/core/src/services/logger apps/core/src/ai/runner/run.ts apps/core/src/controllers/testcase.controller.test.ts
git commit -m "feat(logs): record the cache and reasoning split of every run"
```

---

### PR 1 checkpoint

- [ ] Run `pnpm turbo run test:run --filter=core`, `pnpm turbo run type-check --filter=core` and `pnpm turbo run test:run --filter=web`. Core must be above 944 tests; web must stay at 132.
- [ ] Use the `verifying-changes` skill for the lint and format delta on the touched files.
- [ ] Open the pull request with the `creating-pull-requests` skill. Title: `fix(cost): bill cache and reasoning tokens at their own rates`.
- [ ] State the behaviour change in the PR description, quoting the spec's "Behaviour change to announce": quota charges fall for cached OpenAI, DeepSeek and Gemini input and rise for Gemini thinking models.

---

## PR 2 — show it

### Task 6: Cache prices on model lists and in the price displays

**Files:**
- Modify: `apps/core/src/services/prompt.service.ts:33-36`
- Modify: `apps/core/src/services/organization.service.ts:285-287`
- Test: `apps/core/src/services/prompt.service.test.ts`
- Create: `apps/web/src/lib/usageDisplay.ts`
- Create test: `apps/web/src/lib/usageDisplay.test.ts`
- Modify: `apps/web/src/types/AIModel.ts` (`Model`), `apps/web/src/api/organization/organization.api.ts:190-203` (`LanguageModel`)
- Modify: `apps/web/src/pages/settings/components/OrgModels/ModelsTable.tsx`
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/components/settings-block/models-settings/components/ModelTooltipContent.tsx`

**Interfaces:**
- Consumes: `withCachePrices` (Task 2).
- Produces, from `apps/web/src/lib/usageDisplay.ts`:
  - `formatPricePerMillion(price: number): string`
  - `type SplitLine = { label: string; value: number }`
  - `splitLines(parts: ReadonlyArray<{ label: string; value: number | undefined }>): SplitLine[]`

- [ ] **Step 1: Write the failing tests**

Append to `apps/core/src/services/prompt.service.test.ts`:

```ts
describe("PromptService.getModelsForOrganization", () => {
	it("attaches the registry's cache prices, and null for a custom model", async () => {
		const mockDb = makeMockDb();
		const custom = {
			id: 9,
			name: "my-model",
			vendor: AiVendor.CUSTOM_OPENAI_COMPATIBLE,
			parametersConfig: null,
		};
		mockDb.organization.getAvailableModels.mockResolvedValue([GPT_4O, custom]);
		const service = new PromptService(mockDb as unknown as Database);

		const models = await service.getModelsForOrganization(1);

		expect(models).toEqual([
			{ ...GPT_4O, cacheReadPrice: 1.25, cacheWritePrice: null },
			{ ...custom, cacheReadPrice: null, cacheWritePrice: null },
		]);
	});
});
```

Create `apps/web/src/lib/usageDisplay.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatPricePerMillion, splitLines } from "./usageDisplay";

describe("formatPricePerMillion", () => {
	it("keeps a sub-cent cache price visible", () => {
		expect(formatPricePerMillion(0.005)).toBe("0.005");
		expect(formatPricePerMillion(0.025)).toBe("0.025");
	});

	it("shows a price of a dollar or more to the cent", () => {
		expect(formatPricePerMillion(1.25)).toBe("1.25");
	});
});

describe("splitLines", () => {
	it("keeps only the parts greater than zero, in order", () => {
		expect(
			splitLines([
				{ label: "Cache read", value: 800 },
				{ label: "Cache write", value: 0 },
				{ label: "Reasoning", value: undefined },
				{ label: "Other", value: 5 },
			]),
		).toEqual([
			{ label: "Cache read", value: 800 },
			{ label: "Other", value: 5 },
		]);
	});
});
```

- [ ] **Step 2: Run them, watch them fail**

Run: `pnpm turbo run test:run --filter=core` — Expected: the new `prompt.service.test.ts` test FAILS, because the models have no `cacheReadPrice`.
Run: `pnpm turbo run test:run --filter=web` — Expected: `usageDisplay.test.ts` FAILS to resolve `./usageDisplay`.

- [ ] **Step 3: Implement the core side**

In `apps/core/src/services/prompt.service.ts`, add `import { withCachePrices } from "@/ai/models/pricing";` and:

```ts
	public async getModelsForOrganization(orgId: number) {
		// Use getAvailableModels to filter out disabled models
		const models = await this.db.organization.getAvailableModels(orgId);
		return models.map(withCachePrices);
	}
```

In `apps/core/src/services/organization.service.ts`, add the same import and:

```ts
	public async getOrganizationModels(orgId: number) {
		const models = await this.db.organization.getAllModelsWithStatus(orgId);
		return models.map(withCachePrices);
	}
```

- [ ] **Step 4: Implement the web helper**

Create `apps/web/src/lib/usageDisplay.ts`:

```ts
/**
 * A price per 1M tokens, to as many decimals as a cache price needs. `toFixed(2)` would show
 * gpt-5-nano's $0.005 as $0.01 and a $0.025 cache price as $0.03.
 */
export function formatPricePerMillion(price: number): string {
	return price.toFixed(price < 1 ? 3 : 2);
}

export type SplitLine = { label: string; value: number };

/**
 * The parts of a usage total worth a line: only those greater than zero. A zero part is never
 * shown -- on a row written before the split was recorded it means "not recorded", on a new row
 * it means "none", and neither is worth a line.
 */
export function splitLines(
	parts: ReadonlyArray<{ label: string; value: number | undefined }>,
): SplitLine[] {
	return parts.filter((part): part is SplitLine => part.value !== undefined && part.value > 0);
}
```

- [ ] **Step 5: Show the price**

In `apps/web/src/types/AIModel.ts`, add to `Model` after `completionPrice: number;`:

```ts
	/** USD per 1M cached input tokens, from the model registry. `null` where the vendor lists none. */
	cacheReadPrice?: number | null;
```

Add the same field to `LanguageModel` in `apps/web/src/api/organization/organization.api.ts`, after `completionPrice: number;`.

In `ModelsTable.tsx`:
- Add `import { formatPricePerMillion } from "@/lib/usageDisplay";`.
- After the "Completion Price" `TableHead`, add:

```tsx
								<TableHead className="text-right p-4 w-[120px]">
									Cached Price
									<div className="text-xs font-normal text-muted-foreground">
										/1M tokens
									</div>
								</TableHead>
```

- In `ModelRow`, after the `completionPrice` cell, add:

```tsx
			<TableCell className="align-middle text-right p-4">
				{model.cacheReadPrice != null ? `$${formatPricePerMillion(model.cacheReadPrice)}` : "-"}
			</TableCell>
```

- Change the vendor header row's `colSpan={5}` to `colSpan={6}`.

In `ModelTooltipContent.tsx`, add `import { formatPricePerMillion } from "@/lib/usageDisplay";`. After the "Completion:" row, add:

```tsx
				{model.cacheReadPrice != null && (
					<div className="flex justify-between gap-4 items-center">
						<span className="text-white/70">Cached input:</span>
						<span className="text-white">
							{formatPricePerMillion(model.cacheReadPrice)}$ / 1M
						</span>
					</div>
				)}
```

- [ ] **Step 6: Run tests and type-checks**

Run: `pnpm turbo run test:run --filter=core` — Expected: all PASS.
Run: `pnpm turbo run test:run --filter=web` — Expected: all PASS, 135 tests.
Run: `pnpm turbo run type-check --filter=core` and `pnpm --filter web build` — Expected: clean.

- [ ] **Step 7: Format and commit**

```bash
pnpm exec biome format --write apps/core/src/services/prompt.service.ts apps/core/src/services/organization.service.ts apps/core/src/services/prompt.service.test.ts apps/web/src/lib/usageDisplay.ts apps/web/src/lib/usageDisplay.test.ts apps/web/src/types/AIModel.ts apps/web/src/api/organization/organization.api.ts apps/web/src/pages/settings/components/OrgModels/ModelsTable.tsx apps/web/src/pages/prompt/playground-tabs/playground/components/settings-block/models-settings/components/ModelTooltipContent.tsx
git add apps/core/src/services apps/web/src/lib/usageDisplay.ts apps/web/src/lib/usageDisplay.test.ts apps/web/src/types/AIModel.ts apps/web/src/api/organization/organization.api.ts apps/web/src/pages/settings/components/OrgModels/ModelsTable.tsx apps/web/src/pages/prompt/playground-tabs/playground/components/settings-block/models-settings/components/ModelTooltipContent.tsx
git commit -m "feat(models): show the cached input price"
```

---

### Task 7: The split in the log details dialog

**Files:**
- Modify: `apps/web/src/types/logs.ts` (`Log`)
- Modify: `apps/web/src/lib/usageDisplay.ts`, `apps/web/src/lib/usageDisplay.test.ts`
- Modify: `apps/web/src/pages/prompt/playground-tabs/logs/components/LogDetailsDialog.tsx:220-279`

**Interfaces:**
- Consumes: `splitLines`, `SplitLine` (Task 6); the six `logs` list columns (Task 5).
- Produces: `logTokenSplit(log: Log): SplitLine[]` and `logCostSplit(log: Log): SplitLine[]` from `apps/web/src/lib/usageDisplay.ts`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/lib/usageDisplay.test.ts`, and add `logCostSplit, logTokenSplit` to its import from `./usageDisplay`, plus `import type { Log } from "@/types/logs";`:

```ts
function log(overrides: Partial<Log> = {}): Log {
	return {
		log_id: "1",
		log_lvl: "SUCCESS",
		timestamp: "2026-09-15T12:00:00Z",
		source: "ui",
		vendor: "OPENAI",
		model: "gpt-4o",
		tokens_sum: 1000,
		cost: 0.01,
		response_ms: 100,
		...overrides,
	};
}

describe("log split", () => {
	it("shows nothing for a row written before the split was recorded", () => {
		expect(logTokenSplit(log())).toEqual([]);
		expect(logCostSplit(log())).toEqual([]);
	});

	it("shows each recorded part, and no line for a zero one", () => {
		const row = log({
			tokens_in_cache_read: 800,
			tokens_in_cache_write: 0,
			tokens_out_reasoning: 40,
			cost_in_cache_read: 0.001,
			cost_in_cache_write: 0,
			cost_out_reasoning: 0.0004,
		});

		expect(logTokenSplit(row)).toEqual([
			{ label: "Cache read", value: 800 },
			{ label: "Reasoning", value: 40 },
		]);
		expect(logCostSplit(row)).toEqual([
			{ label: "Cache read", value: 0.001 },
			{ label: "Reasoning", value: 0.0004 },
		]);
	});
});
```

- [ ] **Step 2: Run it, watch it fail**

Run: `pnpm turbo run test:run --filter=web`
Expected: FAIL. `logTokenSplit` is not exported, and `Log` has no split fields.

- [ ] **Step 3: Implement**

In `apps/web/src/types/logs.ts`, add to `Log` after `tokens_out?: number;`:

```ts
	/** Parts of `tokens_in` / `tokens_out` / `cost` (see core `LogUsage`). Zero on rows written before they were recorded. */
	tokens_in_cache_read?: number;
	tokens_in_cache_write?: number;
	tokens_out_reasoning?: number;
	cost_in_cache_read?: number;
	cost_in_cache_write?: number;
	cost_out_reasoning?: number;
```

Append to `apps/web/src/lib/usageDisplay.ts`, with `import type { Log } from "@/types/logs";` at the top:

```ts
export function logTokenSplit(log: Log): SplitLine[] {
	return splitLines([
		{ label: "Cache read", value: log.tokens_in_cache_read },
		{ label: "Cache write", value: log.tokens_in_cache_write },
		{ label: "Reasoning", value: log.tokens_out_reasoning },
	]);
}

export function logCostSplit(log: Log): SplitLine[] {
	return splitLines([
		{ label: "Cache read", value: log.cost_in_cache_read },
		{ label: "Cache write", value: log.cost_in_cache_write },
		{ label: "Reasoning", value: log.cost_out_reasoning },
	]);
}
```

In `LogDetailsDialog.tsx`, add `import { logCostSplit, logTokenSplit } from "@/lib/usageDisplay";`.

Directly after the closing `</div>` of the `grid grid-cols-3 gap-2` token grid (the one that ends after the "Total" cell), add:

```tsx
													<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground empty:hidden">
														{logTokenSplit(selectedLog).map((line) => (
															<span key={line.label}>
																{line.label}:{" "}
																<span className="font-medium text-foreground">
																	{line.value}
																</span>
															</span>
														))}
													</div>
```

Replace the Cost cell's inner wrapper — the `<div className="flex-1 flex items-center justify-center">` that holds `${selectedLog.cost?.toFixed?.(6) ?? 0}` — with:

```tsx
														<div className="flex-1 flex flex-col items-center justify-center">
															<div className="font-medium text-center">
																${selectedLog.cost?.toFixed?.(6) ?? 0}
															</div>
															{logCostSplit(selectedLog).map((line) => (
																<div
																	key={line.label}
																	className="text-xs text-muted-foreground text-center"
																>
																	{line.label} ${line.value.toFixed(6)}
																</div>
															))}
														</div>
```

- [ ] **Step 4: Run tests and type-check**

Run: `pnpm turbo run test:run --filter=web` — Expected: all PASS.
Run: `pnpm --filter web build` — Expected: clean.

- [ ] **Step 5: Format and commit**

```bash
pnpm exec biome format --write apps/web/src/types/logs.ts apps/web/src/lib/usageDisplay.ts apps/web/src/lib/usageDisplay.test.ts apps/web/src/pages/prompt/playground-tabs/logs/components/LogDetailsDialog.tsx
git add apps/web/src/types/logs.ts apps/web/src/lib/usageDisplay.ts apps/web/src/lib/usageDisplay.test.ts apps/web/src/pages/prompt/playground-tabs/logs/components/LogDetailsDialog.tsx
git commit -m "feat(logs): show the cache and reasoning split of a run"
```

---

### Task 8: The split in the playground run metrics

**Files:**
- Modify: `apps/web/src/api/prompt/prompt.api.ts:9-20` (`PromptResponse`)
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/hooks/types.ts:50-62` (`PlaygroundMetricsGroup`)
- Modify: `apps/web/src/pages/prompt/playground-tabs/playground/components/settings-block/models-settings/utils/types.ts:6-10, 29-40`
- Modify: `…/models-settings/SettingsBar.tsx:76-86`
- Modify: `…/models-settings/components/SettingsMetrics.tsx`

**Interfaces:**
- Consumes: `RunCost` and `TokenUsage` as the run endpoint returns them (Tasks 1 and 3).
- Produces: nothing later tasks use.

The web app has no component tests. This task is verified by type-check and by hand (Step 4).

- [ ] **Step 1: Widen the types**

The split fields are optional in all three web types: expected outputs saved on existing testcases have none.

In `prompt.api.ts` (`PromptResponse.tokens` and `PromptResponse.cost`), in `hooks/types.ts` (`PlaygroundMetricsGroup.tokens` and `.cost`), and in `utils/types.ts` (`TimeParam`), add after `total: number;`:

```ts
		cacheRead?: number;
		cacheWrite?: number;
		reasoning?: number;
```

In `utils/types.ts`:

```ts
export interface ExecutionMetricsProps {
	responseTime?: number | null;
	totalTokens?: number;
	promptTokens?: number;
	completionTokens?: number;
	cacheReadTokens?: number;
	cacheWriteTokens?: number;
	reasoningTokens?: number;
}

export interface CostBreakdownMetricsProps {
	promptCost?: number;
	completionCost?: number;
	totalCost?: number;
	cacheReadCost?: number;
	cacheWriteCost?: number;
	reasoningCost?: number;
}
```

- [ ] **Step 2: Pass the parts through**

In `SettingsBar.tsx`, add to `<ExecutionMetrics …>`:

```tsx
								cacheReadTokens={tokens?.cacheRead}
								cacheWriteTokens={tokens?.cacheWrite}
								reasoningTokens={tokens?.reasoning}
```

and to `<CostBreakdownMetrics …>`:

```tsx
								cacheReadCost={cost?.cacheRead}
								cacheWriteCost={cost?.cacheWrite}
								reasoningCost={cost?.reasoning}
```

- [ ] **Step 3: Render the nested rows**

In `SettingsMetrics.tsx`, give `MetricsRow` a `nested` prop:

```tsx
const MetricsRow = ({
	icon,
	title,
	value,
	nested = false,
}: {
	icon: ReactElement;
	title: string;
	value: number | string;
	nested?: boolean;
}) => {
	return (
		<li className="flex justify-between items-center text-foreground font-sans text-[10px] not-italic font-normal leading-[16px]">
			<div className={`flex items-center gap-2${nested ? " pl-4" : ""}`}>
				{icon} {title}
			</div>
			<span>{value}</span>
		</li>
	);
};
```

In `ExecutionMetrics`:
- Destructure `cacheReadTokens, cacheWriteTokens, reasoningTokens`.
- After the "Prompt tokens" row, add:

```tsx
					{!!cacheReadTokens && (
						<MetricsRow nested icon={<Ticket size={16} />} title={"Cache read"} value={cacheReadTokens} />
					)}
					{!!cacheWriteTokens && (
						<MetricsRow nested icon={<Ticket size={16} />} title={"Cache write"} value={cacheWriteTokens} />
					)}
```

- After the "Completion tokens" row, add:

```tsx
					{!!reasoningTokens && (
						<MetricsRow nested icon={<Ticket size={16} />} title={"Reasoning"} value={reasoningTokens} />
					)}
```

- Extend its memo comparator. Without this the rows keep the previous run's values:

```tsx
	(prev, next) =>
		isSameValue(prev.responseTime, next.responseTime) &&
		isSameValue(prev.totalTokens, next.totalTokens) &&
		isSameValue(prev.promptTokens, next.promptTokens) &&
		isSameValue(prev.completionTokens, next.completionTokens) &&
		isSameValue(prev.cacheReadTokens, next.cacheReadTokens) &&
		isSameValue(prev.cacheWriteTokens, next.cacheWriteTokens) &&
		isSameValue(prev.reasoningTokens, next.reasoningTokens),
```

In `CostBreakdownMetrics`:
- Destructure `cacheReadCost, cacheWriteCost, reasoningCost`.
- After the "Prompt Cost" row, add:

```tsx
					{!!cacheReadCost && (
						<MetricsRow nested icon={<Coins size={16} />} title={"Cache read"} value={formatCost(cacheReadCost)} />
					)}
					{!!cacheWriteCost && (
						<MetricsRow nested icon={<Coins size={16} />} title={"Cache write"} value={formatCost(cacheWriteCost)} />
					)}
```

- After the "Completion Cost" row, add:

```tsx
					{!!reasoningCost && (
						<MetricsRow nested icon={<Coins size={16} />} title={"Reasoning"} value={formatCost(reasoningCost)} />
					)}
```

`CostBreakdownMetrics` has no custom comparator, so its default shallow comparison already covers the new props.

- [ ] **Step 4: Verify**

Run: `pnpm --filter web build` — Expected: clean.
Run: `pnpm turbo run test:run --filter=web` — Expected: all PASS, count unchanged from Task 7.

By hand, against the dev app with PR 1 deployed, check each of these:
- A run on `gpt-5` whose prompt is over 1024 tokens, run twice: the second run shows "Cache read" under both Prompt tokens and Prompt Cost.
- A run on `gemini-2.5-flash` shows "Reasoning" under Completion tokens and Completion Cost.
- A run on `claude-haiku-4-5` shows no nested rows.

If the dev app is unavailable, say so in the PR. Never claim a manual check that was not made.

- [ ] **Step 5: Format and commit**

```bash
pnpm exec biome format --write apps/web/src/api/prompt/prompt.api.ts apps/web/src/pages/prompt/playground-tabs/playground/hooks/types.ts apps/web/src/pages/prompt/playground-tabs/playground/components/settings-block/models-settings
git add apps/web/src/api/prompt/prompt.api.ts apps/web/src/pages/prompt/playground-tabs/playground/hooks/types.ts apps/web/src/pages/prompt/playground-tabs/playground/components/settings-block/models-settings
git commit -m "feat(playground): show the cache and reasoning split of a run"
```

---

### PR 2 checkpoint

- [ ] Run `pnpm turbo run test:run --filter=core`, `pnpm turbo run type-check --filter=core`, `pnpm turbo run test:run --filter=web` and `pnpm --filter web build`.
- [ ] Use the `verifying-changes` skill for the lint and format delta.
- [ ] Open the pull request with the `creating-pull-requests` skill. Title: `feat(web): show the cache and reasoning split`.
- [ ] Record in its Verification section exactly which manual checks from Task 8 Step 4 were made.

---

## Self-review notes

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Normalized usage per vendor (table) | Task 1 |
| NaN on missing usage | Task 1 |
| D1, D8 — absolute registry prices, values, omissions | Task 2 |
| D3 — fallback | Task 2 |
| DeepSeek off-peak on cache hits | Task 2 |
| `withCachePrices` | Tasks 2 and 6 |
| Cost formula, clamp, D4 reasoning share | Task 3 |
| D5 / "Summing turns" | Tasks 4 and 5 (the trap test fails at the Task 4 state) |
| D7 — six subset columns, `log_id` untouched, `LOG_LIST_COLUMNS` guard | Task 5 (`usage.test.ts` guard in Task 4) |
| D9 — two PRs | The checkpoints |
| D6 / UI — log dialog | Task 7 |
| D6 / UI — playground | Task 8 |
| D6 / UI — model table and tooltip | Task 6 |

Out of this plan by design: historical rows (a read-only query in the spec, no code) and the behaviour-change notice (the PR 1 checkpoint).

**Placeholders:** none. Test counts after Task 1 (951) and Task 6 (135) are arithmetic on the baseline.

**Type consistency:** these names are used identically in every task — `TokenUsage`, `RunCost`, `ListedPrices`, `Prices`, `PricedModel`, `findRegistryModel`, `getEffectivePrices(model)`, `withCachePrices`, `LogUsage`, `ZERO_USAGE`, `sumUsage`, `formatPricePerMillion`, `SplitLine`, `splitLines`, `logTokenSplit`, `logCostSplit`, and the six column names `tokens_in_cache_read`, `tokens_in_cache_write`, `tokens_out_reasoning`, `cost_in_cache_read`, `cost_in_cache_write`, `cost_out_reasoning`.
