import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Prompt } from "@/prisma";
import { placeholderFingerprint } from "@/ai/placeholders/definitions";
import { commitHash } from "./hash";

const prompt = {
	id: 1,
	value: "You are {{role}}.",
	languageModelId: 7,
	languageModelConfig: { temperature: 1 },
} as unknown as Prompt;

describe("commitHash", () => {
	// The hash decides whether a prompt reads "committed". Adding placeholders to it
	// must not change the hash of every prompt that has none, or the whole fleet would
	// flip to uncommitted on deploy. This pins the pre-placeholder shape byte for byte.
	it("is unchanged for a prompt with no placeholders", () => {
		const legacy = createHash("sha256")
			.update(
				JSON.stringify({
					promptInstructions: prompt.value,
					promptLanguageModelId: prompt.languageModelId,
					promptLanguageModelConfig: prompt.languageModelConfig,
					generations: 3,
				}),
			)
			.digest("hex");

		expect(commitHash(prompt, 3)).toBe(legacy);
		expect(commitHash(prompt, 3, placeholderFingerprint([]))).toBe(legacy);
	});

	it("changes when a placeholder is added", () => {
		const withPlaceholder = placeholderFingerprint([
			{
				key: "role",
				values: [{ name: "admin", content: "You may delete.", isDefault: true }],
			},
		]);

		expect(commitHash(prompt, 3, withPlaceholder)).not.toBe(commitHash(prompt, 3));
	});

	it("changes when a key is renamed", () => {
		const before = placeholderFingerprint([
			{ key: "role", values: [{ name: "admin", content: "x", isDefault: true }] },
		]);
		const after = placeholderFingerprint([
			{ key: "admin_role", values: [{ name: "admin", content: "x", isDefault: true }] },
		]);

		expect(commitHash(prompt, 3, before)).not.toBe(commitHash(prompt, 3, after));
	});

	it("changes when a value's content is edited", () => {
		const before = placeholderFingerprint([
			{ key: "role", values: [{ name: "admin", content: "x", isDefault: true }] },
		]);
		const after = placeholderFingerprint([
			{ key: "role", values: [{ name: "admin", content: "y", isDefault: true }] },
		]);

		expect(commitHash(prompt, 3, before)).not.toBe(commitHash(prompt, 3, after));
	});

	it("changes when the default moves to another value", () => {
		const before = placeholderFingerprint([
			{
				key: "role",
				values: [
					{ name: "admin", content: "x", isDefault: true },
					{ name: "user", content: "y", isDefault: false },
				],
			},
		]);
		const after = placeholderFingerprint([
			{
				key: "role",
				values: [
					{ name: "admin", content: "x", isDefault: false },
					{ name: "user", content: "y", isDefault: true },
				],
			},
		]);

		expect(commitHash(prompt, 3, before)).not.toBe(commitHash(prompt, 3, after));
	});
});

describe("placeholderFingerprint", () => {
	it("is null for no placeholders, so commitHash can omit the field entirely", () => {
		expect(placeholderFingerprint([])).toBeNull();
	});

	// Rows are read ordered by id, so a delete-and-recreate reorders them without
	// changing what the model receives. That must not read as an edit.
	it("ignores the order of placeholders and of their values", () => {
		const one = placeholderFingerprint([
			{
				key: "tone",
				values: [
					{ name: "warm", content: "w", isDefault: false },
					{ name: "curt", content: "c", isDefault: true },
				],
			},
			{ key: "role", values: [{ name: "admin", content: "a", isDefault: true }] },
		]);
		const two = placeholderFingerprint([
			{ key: "role", values: [{ name: "admin", content: "a", isDefault: true }] },
			{
				key: "tone",
				values: [
					{ name: "curt", content: "c", isDefault: true },
					{ name: "warm", content: "w", isDefault: false },
				],
			},
		]);

		expect(one).toBe(two);
	});
});
