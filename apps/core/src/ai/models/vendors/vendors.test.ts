import { describe, it, expect } from "vitest";
import { AiVendor } from "@/prisma";
import { findRegistryModel, getEffectivePrices } from "../pricing";

const CLAUDE_EFFORT = ["low", "medium", "high", "xhigh", "max"];

/** Published prices, USD per 1M tokens, retrieved 2026-10-05. */
const NEW_CLAUDE = [
	{ name: "claude-sonnet-5-5", prices: [2, 10, 0.2, 2.5], effort: "high" },
	{ name: "claude-opus-5-5", prices: [4, 20, 0.2, 5], effort: "medium" },
	{ name: "claude-fable-5-1", prices: [10, 50, 0.25, 12.5], effort: "high" },
	{ name: "claude-opus-5", prices: [5, 25, 0.5, 6.25], effort: "high" },
	{ name: "claude-sonnet-5", prices: [2, 10, 0.2, 2.5], effort: "high" },
	{ name: "claude-fable-5", prices: [10, 50, 1, 12.5], effort: "high" },
	{ name: "claude-opus-4-8", prices: [5, 25, 0.5, 6.25], effort: "high" },
] as const;

const NEW_GPT = [
	{ name: "gpt-6-astra", prices: [10, 50, 1, 12.5] },
	{ name: "gpt-6.1-sol", prices: [2, 10, 0.1, 2.5] },
	{ name: "gpt-6-luna", prices: [0.1, 0.5, 0.01, 0.125] },
] as const;

function prices(vendor: AiVendor, name: string) {
	const model = findRegistryModel(vendor, name);
	if (!model) throw new Error(`${name} is not in the registry`);
	return getEffectivePrices(model);
}

describe("new Claude models", () => {
	it.each(NEW_CLAUDE)("lists $name at its published prices", ({ name, prices: p }) => {
		expect(prices(AiVendor.ANTHROPIC, name)).toEqual({
			prompt: p[0],
			completion: p[1],
			cacheRead: p[2],
			cacheWrite: p[3],
		});
	});

	// Every one of them answers 400 to a non-default temperature, top_p or top_k.
	it.each(NEW_CLAUDE)("offers effort and no temperature on $name", ({ name, effort }) => {
		const model = findRegistryModel(AiVendor.ANTHROPIC, name);
		expect(model?.parameters.temperature).toBeUndefined();
		expect(model?.parameters.reasoning_effort).toEqual({
			allowed: CLAUDE_EFFORT,
			default: effort,
		});
		expect(model?.parameters.max_tokens?.max).toBe(128_000);
	});
});

describe("new GPT-6 models", () => {
	it.each(NEW_GPT)("lists $name at its published prices", ({ name, prices: p }) => {
		expect(prices(AiVendor.OPENAI, name)).toEqual({
			prompt: p[0],
			completion: p[1],
			cacheRead: p[2],
			cacheWrite: p[3],
		});
	});

	it.each(NEW_GPT)("offers reasoning effort and no temperature on $name", ({ name }) => {
		const model = findRegistryModel(AiVendor.OPENAI, name);
		expect(model?.parameters.temperature).toBeUndefined();
		expect(model?.parameters.reasoning_effort?.default).toBe("medium");
	});
});
