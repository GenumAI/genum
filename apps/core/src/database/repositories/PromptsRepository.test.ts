import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromptsRepository } from "./PromptsRepository";
import type { SystemRepository } from "./SystemRepository";
import { AiVendor, Prisma, type PrismaClient } from "@/prisma";

function makeMockPrisma() {
	return {
		languageModel: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
		},
		prompt: {
			create: vi.fn(),
		},
	};
}

const DEFAULT_MODEL_ROW = {
	id: 1,
	name: "gpt-4o",
	vendor: AiVendor.OPENAI,
	parametersConfig: null,
};

describe("PromptsRepository.newProjectPrompt", () => {
	let mockPrisma: ReturnType<typeof makeMockPrisma>;
	let repo: PromptsRepository;

	beforeEach(() => {
		mockPrisma = makeMockPrisma();
		repo = new PromptsRepository(
			mockPrisma as unknown as PrismaClient,
			{} as unknown as SystemRepository,
		);
	});

	it("falls back to the default language model when no override is given (unchanged historical behavior)", async () => {
		mockPrisma.languageModel.findUnique.mockResolvedValue(DEFAULT_MODEL_ROW);
		mockPrisma.prompt.create.mockResolvedValue({ id: 99 });

		await repo.newProjectPrompt(10, { name: "n", value: "v" }, 5);

		expect(mockPrisma.prompt.create).toHaveBeenCalledWith({
			data: {
				name: "n",
				value: "v",
				languageModelConfig: {
					temperature: 1,
					max_tokens: 16384,
					response_format: "text",
					tools: [],
				},
				languageModel: { connect: { id: 1 } },
				project: { connect: { id: 10 } },
				branches: { create: { name: "master" } },
			},
		});
	});

	it("persists an explicit override without touching the default-model lookup", async () => {
		mockPrisma.prompt.create.mockResolvedValue({ id: 100 });

		await repo.newProjectPrompt(
			10,
			{ name: "n", value: "v" },
			5,
			{ languageModelId: 42, languageModelConfig: { response_format: "json_object" } },
		);

		expect(mockPrisma.languageModel.findUnique).not.toHaveBeenCalled();
		expect(mockPrisma.languageModel.findFirst).not.toHaveBeenCalled();
		expect(mockPrisma.prompt.create).toHaveBeenCalledWith({
			data: {
				name: "n",
				value: "v",
				languageModelConfig: { response_format: "json_object" },
				languageModel: { connect: { id: 42 } },
				project: { connect: { id: 10 } },
				branches: { create: { name: "master" } },
			},
		});
	});
});

describe("PromptsRepository.getDefaultLanguageModelRow", () => {
	let mockPrisma: ReturnType<typeof makeMockPrisma>;
	let repo: PromptsRepository;

	beforeEach(() => {
		mockPrisma = makeMockPrisma();
		repo = new PromptsRepository(
			mockPrisma as unknown as PrismaClient,
			{} as unknown as SystemRepository,
		);
	});

	it("returns the full row for the default language model", async () => {
		mockPrisma.languageModel.findUnique.mockResolvedValue(DEFAULT_MODEL_ROW);

		const row = await repo.getDefaultLanguageModelRow();

		expect(row).toEqual(DEFAULT_MODEL_ROW);
	});

	it("throws when the default model row has vanished between lookups", async () => {
		mockPrisma.languageModel.findUnique
			.mockResolvedValueOnce(DEFAULT_MODEL_ROW) // inside getDefaultLanguageModel()
			.mockResolvedValueOnce(null); // the row-fetch in getDefaultLanguageModelRow()

		await expect(repo.getDefaultLanguageModelRow()).rejects.toThrow(
			"Default language model not found in database",
		);
	});
});

describe("PromptsRepository.rollbackPrompt", () => {
	function makeTxPrisma() {
		const tx = {
			audit: { update: vi.fn().mockResolvedValue({}) },
			prompt: { update: vi.fn().mockResolvedValue({ id: 12 }) },
		};
		const prisma = {
			audit: { update: vi.fn().mockResolvedValue({}) },
			prompt: { update: vi.fn().mockResolvedValue({ id: 12 }) },
			$transaction: vi.fn(async (cb: (c: typeof tx) => unknown) => cb(tx)),
		};
		return { prisma, tx };
	}

	const VERSION = {
		value: "restored",
		languageModelConfig: { temperature: 1 },
		languageModelId: 3,
		audit: { a: 1 },
	};

	it("applies the audit and prompt writes atomically", async () => {
		// Previously these were two independent statements: a crash between them left
		// the prompt rolled back while the audit still held the newer data.
		const { prisma, tx } = makeTxPrisma();
		const repo = new PromptsRepository(
			prisma as unknown as PrismaClient,
			{} as unknown as SystemRepository,
		);

		await repo.rollbackPrompt(12, VERSION as never, true);

		expect(prisma.$transaction).toHaveBeenCalledTimes(1);
		expect(tx.audit.update).toHaveBeenCalledTimes(1);
		expect(tx.prompt.update).toHaveBeenCalledTimes(1);
		// Nothing may be written outside the transaction.
		expect(prisma.audit.update).not.toHaveBeenCalled();
		expect(prisma.prompt.update).not.toHaveBeenCalled();
	});

	it("still runs inside a transaction when there is no audit to restore", async () => {
		const { prisma, tx } = makeTxPrisma();
		const repo = new PromptsRepository(
			prisma as unknown as PrismaClient,
			{} as unknown as SystemRepository,
		);

		await repo.rollbackPrompt(12, VERSION as never, false);

		expect(prisma.$transaction).toHaveBeenCalledTimes(1);
		expect(tx.audit.update).not.toHaveBeenCalled();
		expect(tx.prompt.update).toHaveBeenCalledTimes(1);
	});
});

describe("PromptsRepository.commit", () => {
	function makeCommitPrisma() {
		return {
			branch: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
			prompt: {
				findUnique: vi.fn().mockResolvedValue({
					id: 5,
					value: "text",
					languageModelId: 3,
					languageModelConfig: {},
					audit: null,
				}),
			},
			promptVersion: {
				count: vi.fn().mockResolvedValue(0),
				create: vi.fn().mockResolvedValue({ id: 99 }),
			},
			placeholder: {
				findMany: vi.fn().mockResolvedValue([
					{
						id: 1,
						key: "live_key",
						values: [{ id: 1, name: "n", content: "live content", isDefault: false }],
					},
				]),
			},
		};
	}

	it("snapshots the live placeholder tables when no override is given", async () => {
		const prisma = makeCommitPrisma();
		const repo = new PromptsRepository(
			prisma as unknown as PrismaClient,
			{} as unknown as SystemRepository,
		);

		await repo.commit(5, "msg", 1);

		expect(prisma.placeholder.findMany).toHaveBeenCalledTimes(1);
		const data = prisma.promptVersion.create.mock.calls[0][0].data;
		expect(data.placeholders).toEqual([
			{ key: "live_key", values: [{ name: "n", content: "live content", isDefault: false }] },
		]);
	});

	// C2: rollback must reproduce the old commit exactly -- text and definitions
	// from the SAME version -- not pair old text with today's live definitions.
	it("carries the restored version's own snapshot forward instead of the live tables", async () => {
		const prisma = makeCommitPrisma();
		const repo = new PromptsRepository(
			prisma as unknown as PrismaClient,
			{} as unknown as SystemRepository,
		);

		const restoredSnapshot = [
			{
				key: "admin_role",
				values: [
					{ name: "on", content: "act as admin", isDefault: false },
					{ name: "off", content: "", isDefault: true },
				],
			},
		];

		await repo.commit(5, "Rollback to abcd1234", 1, restoredSnapshot);

		expect(prisma.placeholder.findMany).not.toHaveBeenCalled();
		const data = prisma.promptVersion.create.mock.calls[0][0].data;
		expect(data.placeholders).toEqual(restoredSnapshot);
	});

	it("stores JSON null when the restored version had no snapshot", async () => {
		const prisma = makeCommitPrisma();
		const repo = new PromptsRepository(
			prisma as unknown as PrismaClient,
			{} as unknown as SystemRepository,
		);

		await repo.commit(5, "Rollback to abcd1234", 1, null);

		expect(prisma.placeholder.findMany).not.toHaveBeenCalled();
		const data = prisma.promptVersion.create.mock.calls[0][0].data;
		expect(data.placeholders).toBe(Prisma.JsonNull);
	});
});
