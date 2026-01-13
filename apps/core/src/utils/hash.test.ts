import { describe, it, expect } from "vitest";
import { commitHash } from "./hash";
import type { Prompt } from "@/prisma";

describe("commitHash utility", () => {
	const mockPrompt = {
		id: 1,
		value: "Initial prompt value",
		languageModelId: 1,
		languageModelConfig: { temperature: 0.5 },
		projectId: 1,
		name: "Test Prompt",
		assertionType: "TEXT" as any,
		assertionValue: null,
		commited: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as unknown as Prompt;

	it("should generate a consistent hash for the same input", () => {
		const hash1 = commitHash(mockPrompt, 0);
		const hash2 = commitHash(mockPrompt, 0);

		expect(hash1).toBe(hash2);
		expect(typeof hash1).toBe("string");
		expect(hash1).toHaveLength(64); // SHA-256 hex length
	});

	it("should change hash when prompt value changes", () => {
		const hash1 = commitHash(mockPrompt, 0);
		const hash2 = commitHash({ ...mockPrompt, value: "Changed prompt value" }, 0);

		expect(hash1).not.toBe(hash2);
	});

	it("should change hash when language model ID changes", () => {
		const hash1 = commitHash(mockPrompt, 0);
		const hash2 = commitHash({ ...mockPrompt, languageModelId: 2 }, 0);

		expect(hash1).not.toBe(hash2);
	});

	it("should change hash when language model config changes", () => {
		const hash1 = commitHash(mockPrompt, 0);
		const hash2 = commitHash(
			{ ...mockPrompt, languageModelConfig: JSON.stringify({ temperature: 0.7 }) },
			0,
		);

		expect(hash1).not.toBe(hash2);
	});

	it("should change hash when generations count changes", () => {
		const hash1 = commitHash(mockPrompt, 0);
		const hash2 = commitHash(mockPrompt, 1);

		expect(hash1).not.toBe(hash2);
	});

	it("should ignore changes in non-indexed fields (like name)", () => {
		const hash1 = commitHash(mockPrompt, 0);
		const hash2 = commitHash({ ...mockPrompt, name: "New Name" }, 0);

		expect(hash1).toBe(hash2);
	});
});
