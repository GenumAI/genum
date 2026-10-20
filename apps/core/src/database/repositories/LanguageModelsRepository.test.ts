import { describe, it, expect, vi, beforeEach } from "vitest";
import { LanguageModelsRepository } from "./LanguageModelsRepository";
import { AiVendor, type PrismaClient } from "@/prisma";

function makeMockPrisma() {
	return {
		languageModel: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
		},
		organizationDisabledModel: {
			findUnique: vi.fn(),
		},
	};
}

const ORG = 1;
const MODEL = 57;

describe("LanguageModelsRepository.isModelAvailableForOrg", () => {
	let mockPrisma: ReturnType<typeof makeMockPrisma>;
	let repo: LanguageModelsRepository;

	beforeEach(() => {
		mockPrisma = makeMockPrisma();
		repo = new LanguageModelsRepository(mockPrisma as unknown as PrismaClient);
		mockPrisma.organizationDisabledModel.findUnique.mockResolvedValue(null);
	});

	it("allows a global model", async () => {
		mockPrisma.languageModel.findFirst.mockResolvedValue({ id: MODEL });

		expect(await repo.isModelAvailableForOrg(ORG, MODEL)).toBe(true);
	});

	it("refuses a model that is neither global nor owned by the organization", async () => {
		// This is the allow-list the old deny-list check was missing: a model behind
		// another organization's custom provider key is simply absent from this
		// organization's disabled list, so the old check waved it through.
		mockPrisma.languageModel.findFirst.mockResolvedValue(null);

		expect(await repo.isModelAvailableForOrg(ORG, MODEL)).toBe(false);
	});

	it("restricts the lookup to global models and this organization's own keys", async () => {
		mockPrisma.languageModel.findFirst.mockResolvedValue({ id: MODEL });

		await repo.isModelAvailableForOrg(ORG, MODEL);

		expect(mockPrisma.languageModel.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: MODEL,
					OR: [{ apiKeyId: null }, { apiKey: { organizationId: ORG } }],
				},
			}),
		);
	});

	it("still refuses a reachable model the organization has disabled", async () => {
		mockPrisma.languageModel.findFirst.mockResolvedValue({ id: MODEL });
		mockPrisma.organizationDisabledModel.findUnique.mockResolvedValue({ modelId: MODEL });

		expect(await repo.isModelAvailableForOrg(ORG, MODEL)).toBe(false);
	});
});

const DEFAULT_MODEL_ROW = {
	id: 1,
	name: "gpt-4o",
	vendor: AiVendor.OPENAI,
	parametersConfig: null,
};

describe("LanguageModelsRepository.getDefaultLanguageModelRow", () => {
	let mockPrisma: ReturnType<typeof makeMockPrisma>;
	let repo: LanguageModelsRepository;

	beforeEach(() => {
		mockPrisma = makeMockPrisma();
		repo = new LanguageModelsRepository(mockPrisma as unknown as PrismaClient);
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
