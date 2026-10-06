import { describe, it, expect, vi } from "vitest";
import { AiVendor } from "@/prisma";

// The seed's data is all this reads; what the seed module imports alongside it needs a database
// and a validated environment.
vi.mock("@/database/db", () => ({ db: {} }));
vi.mock("@/ai/runner/system", () => ({
	SYSTEM_PROMPTS: new Proxy({}, { get: (_, key) => key }),
}));

import { DEFAULT_SYSTEM_PROMPTS_DATA } from "@/database/seed/system-prompts";
import { getModelLifecycle, retiredModelMessage, withLifecycle } from "./lifecycle";
import { ALL_MODELS } from "./vendors";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("model lifecycle", () => {
	it("is null for a current model and for one outside the registry", () => {
		expect(getModelLifecycle({ vendor: AiVendor.ANTHROPIC, name: "claude-sonnet-4-6" })).toBe(
			null,
		);
		expect(getModelLifecycle({ vendor: AiVendor.OPENAI, name: "my-custom-model" })).toBe(null);
	});

	it("names the vendor, the date and the replacement when refusing a retired model", () => {
		expect(
			retiredModelMessage({ vendor: AiVendor.ANTHROPIC, name: "claude-sonnet-4-0" }),
		).toBe(
			"Claude Sonnet 4.0 was shut down by Anthropic on 2026-06-15 and can no longer run. " +
				"Switch this prompt to another model, such as Claude Sonnet 4.6.",
		);
	});

	it("is null for a model that is not retired", () => {
		expect(retiredModelMessage({ vendor: AiVendor.ANTHROPIC, name: "claude-sonnet-4-5" })).toBe(
			null,
		);
	});

	it("adds the lifecycle to a listed model", () => {
		const row = { id: 1, vendor: AiVendor.ANTHROPIC, name: "claude-sonnet-4-5" };
		expect(withLifecycle(row)).toEqual({
			...row,
			lifecycle: {
				status: "deprecated",
				retiresOn: "2026-11-30",
				replacement: "claude-sonnet-4-6",
				replacementDisplayName: "Claude Sonnet 4.6",
			},
		});
		expect(withLifecycle({ vendor: AiVendor.OPENAI, name: "gpt-5.5" }).lifecycle).toBe(null);
	});

	// Only models their vendor has already shut down. Announced shutdowns stay usable until then.
	it("retires exactly the models already shut down", () => {
		const retired = ALL_MODELS.filter((m) => m.lifecycle?.status === "retired").map(
			(m) => m.name,
		);
		expect(retired.sort()).toEqual([
			"claude-3-7-sonnet-latest",
			"claude-sonnet-4-0",
			"gemini-2.0-flash",
			"gemini-2.0-flash-lite",
			"gemini-3-pro-preview",
		]);
	});
});

describe("registry lifecycle entries", () => {
	const withdrawn = ALL_MODELS.filter((m) => m.lifecycle);

	it.each(withdrawn.map((m) => [m.name, m] as const))("%s has a valid date", (_, m) => {
		const lifecycle = m.lifecycle!;
		const date = lifecycle.status === "retired" ? lifecycle.retiredOn : lifecycle.retiresOn;
		expect(date).toMatch(ISO_DATE);
		expect(Number.isNaN(Date.parse(date))).toBe(false);
	});

	it.each(
		withdrawn.filter((m) => m.lifecycle?.replacement).map((m) => [m.name, m] as const),
	)("%s suggests a usable model of its own vendor", (_, m) => {
		const replacement = ALL_MODELS.find(
			(r) => r.name === m.lifecycle?.replacement && r.vendor === m.vendor,
		);
		expect(replacement).toBeDefined();
		expect(replacement?.lifecycle?.status).not.toBe("retired");
	});

	// A system prompt on a retired model fails every Genum feature built on it.
	it.each(
		DEFAULT_SYSTEM_PROMPTS_DATA.map((p) => [p.name, p.languageModelName] as const),
	)("system prompt %s does not run on a retired model", (_, modelName) => {
		const m = ALL_MODELS.find((r) => r.name === modelName);
		expect(m).toBeDefined();
		expect(m?.lifecycle?.status).not.toBe("retired");
	});
});
