import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	checkPromptAccess,
	checkMemoryAccess,
	checkTestcaseAccess,
	getApiKeyByQuota,
} from "./AccessService";
import { db } from "@/database/db";
import { isCloudInstance } from "@/utils/env";
import { AiVendor } from "@/prisma";

vi.mock("@/database/db", () => ({
	db: {
		prompts: {
			getPromptById: vi.fn(),
		},
		memories: {
			getMemoryByIDAndPromptId: vi.fn(),
		},
		testcases: {
			getTestcaseByID: vi.fn(),
		},
		organization: {
			getOrganizationApiKey: vi.fn(),
		},
		system: {
			getSystemOrganizationId: vi.fn(),
		},
	},
}));

vi.mock("@/utils/env", () => ({
	isCloudInstance: vi.fn(),
}));

describe("AccessService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("checkPromptAccess", () => {
		it("should return prompt if it exists and belongs to project", async () => {
			const mockPrompt = { id: 1, projectId: 10 };
			vi.mocked(db.prompts.getPromptById).mockResolvedValue(mockPrompt as any);

			const result = await checkPromptAccess(1, 10);
			expect(result).toEqual(mockPrompt);
		});

		it("should throw error if prompt is not found", async () => {
			vi.mocked(db.prompts.getPromptById).mockResolvedValue(null);

			await expect(checkPromptAccess(1, 10)).rejects.toThrow("Prompt is not found");
		});

		it("should throw error if prompt belongs to another project", async () => {
			const mockPrompt = { id: 1, projectId: 20 };
			vi.mocked(db.prompts.getPromptById).mockResolvedValue(mockPrompt as any);

			await expect(checkPromptAccess(1, 10)).rejects.toThrow("Prompt is not found");
		});
	});

	describe("checkMemoryAccess", () => {
		it("should return memory if it exists and belongs to prompt", async () => {
			const mockMemory = { id: 1, promptId: 100 };
			vi.mocked(db.memories.getMemoryByIDAndPromptId).mockResolvedValue(mockMemory as any);

			const result = await checkMemoryAccess(1, 100);
			expect(result).toEqual(mockMemory);
		});

		it("should throw error if memory is not found", async () => {
			vi.mocked(db.memories.getMemoryByIDAndPromptId).mockResolvedValue(null);

			await expect(checkMemoryAccess(1, 100)).rejects.toThrow("Memory is not found");
		});
	});

	describe("checkTestcaseAccess", () => {
		it("should return testcase if it exists and belongs to project", async () => {
			const mockTestcase = { id: 1, prompt: { projectId: 10 } };
			vi.mocked(db.testcases.getTestcaseByID).mockResolvedValue(mockTestcase as any);

			const result = await checkTestcaseAccess(1, 10);
			expect(result).toEqual(mockTestcase);
		});

		it("should throw error if testcase is not found", async () => {
			vi.mocked(db.testcases.getTestcaseByID).mockResolvedValue(null);

			await expect(checkTestcaseAccess(1, 10)).rejects.toThrow("Testcase is not found");
		});

		it("should throw error if testcase belongs to another project", async () => {
			const mockTestcase = { id: 1, prompt: { projectId: 20 } };
			vi.mocked(db.testcases.getTestcaseByID).mockResolvedValue(mockTestcase as any);

			await expect(checkTestcaseAccess(1, 10)).rejects.toThrow("Testcase is not found");
		});
	});

	describe("getApiKeyByQuota", () => {
		const mockOrgId = 123;
		const mockVendor = AiVendor.OPENAI;

		describe("Cloud Instance", () => {
			beforeEach(() => {
				vi.mocked(isCloudInstance).mockReturnValue(true);
			});

			it("should return user API key when balance is 0 or less", async () => {
				const mockApiKey = { key: "user-key" };
				vi.mocked(db.organization.getOrganizationApiKey).mockResolvedValue(
					mockApiKey as any,
				);

				const result = await getApiKeyByQuota({ balance: 0 } as any, mockOrgId, mockVendor);

				expect(result).toEqual({ apiKey: mockApiKey, quotaUsed: false });
				expect(db.organization.getOrganizationApiKey).toHaveBeenCalledWith(
					mockOrgId,
					mockVendor,
				);
			});

			it("should throw error if user API key is not found when balance is 0", async () => {
				vi.mocked(db.organization.getOrganizationApiKey).mockResolvedValue(null);

				await expect(
					getApiKeyByQuota({ balance: 0 } as any, mockOrgId, mockVendor),
				).rejects.toThrow(`User API key not found for ${mockVendor}`);
			});

			it("should return system API key when balance is positive", async () => {
				const mockSystemId = 1;
				const mockSystemApiKey = { key: "system-key" };
				vi.mocked(db.system.getSystemOrganizationId).mockResolvedValue(mockSystemId);
				vi.mocked(db.organization.getOrganizationApiKey).mockResolvedValue(
					mockSystemApiKey as any,
				);

				const result = await getApiKeyByQuota(
					{ balance: 100 } as any,
					mockOrgId,
					mockVendor,
				);

				expect(result).toEqual({ apiKey: mockSystemApiKey, quotaUsed: true });
				expect(db.system.getSystemOrganizationId).toHaveBeenCalled();
				expect(db.organization.getOrganizationApiKey).toHaveBeenCalledWith(
					mockSystemId,
					mockVendor,
				);
			});
		});

		describe("Local Instance", () => {
			beforeEach(() => {
				vi.mocked(isCloudInstance).mockReturnValue(false);
			});

			it("should always return system API key regardless of balance", async () => {
				const mockSystemId = 1;
				const mockSystemApiKey = { key: "system-key" };
				vi.mocked(db.system.getSystemOrganizationId).mockResolvedValue(mockSystemId);
				vi.mocked(db.organization.getOrganizationApiKey).mockResolvedValue(
					mockSystemApiKey as any,
				);

				const result = await getApiKeyByQuota({ balance: 0 } as any, mockOrgId, mockVendor);

				expect(result).toEqual({ apiKey: mockSystemApiKey, quotaUsed: true });
				expect(db.system.getSystemOrganizationId).toHaveBeenCalled();
				expect(db.organization.getOrganizationApiKey).toHaveBeenCalledWith(
					mockSystemId,
					mockVendor,
				);
			});

			it("should throw error if system organization ID is not found", async () => {
				vi.mocked(db.system.getSystemOrganizationId).mockResolvedValue(null);

				await expect(
					getApiKeyByQuota({ balance: 0 } as any, mockOrgId, mockVendor),
				).rejects.toThrow("System organization ID not found in database");
			});

			it("should throw error if system API key is not found", async () => {
				vi.mocked(db.system.getSystemOrganizationId).mockResolvedValue(1);
				vi.mocked(db.organization.getOrganizationApiKey).mockResolvedValue(null);

				await expect(
					getApiKeyByQuota({ balance: 0 } as any, mockOrgId, mockVendor),
				).rejects.toThrow(`System API key not found for ${mockVendor}`);
			});
		});
	});
});
