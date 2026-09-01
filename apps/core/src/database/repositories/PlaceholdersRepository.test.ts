import { describe, it, expect, vi } from "vitest";
import { PlaceholdersRepository } from "./PlaceholdersRepository";
import type { PrismaClient } from "@/prisma";

function makeMockPrisma(placeholders: unknown[]) {
	return {
		placeholder: {
			findMany: vi.fn().mockResolvedValue(placeholders),
		},
	};
}

describe("PlaceholdersRepository.resolveSelection", () => {
	// C3: `memory_key` (and any placeholder with no default) is intentionally logged
	// as "" when nothing was selected. That is not a lost value -- treating it as
	// unresolved falsely told the user a placeholder "could not transfer" on a run
	// where nothing was selected and nothing was lost.
	it("skips an empty-string selection entirely -- neither a row nor unresolved", async () => {
		const mockPrisma = makeMockPrisma([
			{ id: 1, key: "memory_key", values: [{ id: 10, name: "greeting", content: "hi" }] },
		]);
		const repo = new PlaceholdersRepository(mockPrisma as unknown as PrismaClient);

		const result = await repo.resolveSelection(5, { memory_key: "" });

		expect(result.rows).toEqual([]);
		expect(result.unresolved).toEqual([]);
	});

	it("still reports a genuinely unresolved non-empty selection", async () => {
		const mockPrisma = makeMockPrisma([
			{ id: 1, key: "admin_role", values: [{ id: 10, name: "true", content: "x" }] },
		]);
		const repo = new PlaceholdersRepository(mockPrisma as unknown as PrismaClient);

		const result = await repo.resolveSelection(5, { admin_role: "typo_value" });

		expect(result.rows).toEqual([]);
		expect(result.unresolved).toEqual(["admin_role"]);
	});

	it("resolves a matching non-empty selection to a row", async () => {
		const mockPrisma = makeMockPrisma([
			{ id: 1, key: "admin_role", values: [{ id: 10, name: "true", content: "act as admin" }] },
		]);
		const repo = new PlaceholdersRepository(mockPrisma as unknown as PrismaClient);

		const result = await repo.resolveSelection(5, { admin_role: "true" });

		expect(result.rows).toEqual([
			{ placeholderId: 1, placeholderValueId: 10, content: "act as admin" },
		]);
		expect(result.unresolved).toEqual([]);
	});

	it("mixes an ignored empty selection with a resolved and an unresolved one", async () => {
		const mockPrisma = makeMockPrisma([
			{ id: 1, key: "memory_key", values: [{ id: 10, name: "greeting", content: "hi" }] },
			{ id: 2, key: "admin_role", values: [{ id: 20, name: "true", content: "act as admin" }] },
		]);
		const repo = new PlaceholdersRepository(mockPrisma as unknown as PrismaClient);

		const result = await repo.resolveSelection(5, {
			memory_key: "",
			admin_role: "true",
			tone: "missing",
		});

		expect(result.rows).toEqual([
			{ placeholderId: 2, placeholderValueId: 20, content: "act as admin" },
		]);
		expect(result.unresolved).toEqual(["tone"]);
	});
});
