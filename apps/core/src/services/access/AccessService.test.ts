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
import { HttpError } from "@/utils/errors";
import type { OrganizationQuota } from "@/prisma";

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

	describe("status codes", () => {
		// These used to throw a bare Error, which the global handler turned into a 500
		// with a Sentry event -- so every probe for someone else's prompt id looked
		// like a server fault and polluted error monitoring.
		it("reports a missing prompt as 404, not a server error", async () => {
			vi.mocked(db.prompts.getPromptById).mockResolvedValue(null);

			await expect(checkPromptAccess(1, 10)).rejects.toMatchObject({ statusCode: 404 });
		});

		it("reports a prompt from another project as 404", async () => {
			vi.mocked(db.prompts.getPromptById).mockResolvedValue({ id: 1, projectId: 20 } as any);

			await expect(checkPromptAccess(1, 10)).rejects.toBeInstanceOf(HttpError);
		});

		it("reports a missing memory as 404", async () => {
			vi.mocked(db.memories.getMemoryByIDAndPromptId).mockResolvedValue(null);

			await expect(checkMemoryAccess(1, 100)).rejects.toMatchObject({ statusCode: 404 });
		});

		it("reports a missing testcase as 404", async () => {
			vi.mocked(db.testcases.getTestcaseByID).mockResolvedValue(null);

			await expect(checkTestcaseAccess(1, 10)).rejects.toMatchObject({ statusCode: 404 });
		});
	});

	describe("getApiKeyByQuota", () => {
		const mockOrgId = 123;
		const mockVendor = AiVendor.OPENAI;

		/** Only `balance` is read by getApiKeyByQuota. */
		const quotaOf = (balance: number) => ({ balance }) as unknown as OrganizationQuota;

		describe("Cloud Instance", () => {
			beforeEach(() => {
				vi.mocked(isCloudInstance).mockReturnValue(true);
			});

			it("should return user API key when balance is 0 or less", async () => {
				const mockApiKey = { key: "user-key" };
				vi.mocked(db.organization.getOrganizationApiKey).mockResolvedValue(
					mockApiKey as any,
				);

				const result = await getApiKeyByQuota(quotaOf(0), mockOrgId, mockVendor);

				expect(result).toEqual({ apiKey: mockApiKey, quotaUsed: false });
				expect(db.organization.getOrganizationApiKey).toHaveBeenCalledWith(
					mockOrgId,
					mockVendor,
				);
			});

			it("should throw error if user API key is not found when balance is 0", async () => {
				vi.mocked(db.organization.getOrganizationApiKey).mockResolvedValue(null);

				await expect(
					getApiKeyByQuota(quotaOf(0), mockOrgId, mockVendor),
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
					quotaOf(100),
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
			const SYSTEM_ORG_ID = 1;

			/** Serves a different key per organization, as the database would. */
			function keysByOrg(keys: Record<number, { key: string } | null>) {
				vi.mocked(db.system.getSystemOrganizationId).mockResolvedValue(SYSTEM_ORG_ID);
				vi.mocked(db.organization.getOrganizationApiKey).mockImplementation(
					async (orgId: number) =>
						(keys[orgId] ?? null) as Awaited<
							ReturnType<typeof db.organization.getOrganizationApiKey>
						>,
				);
			}

			beforeEach(() => {
				vi.mocked(isCloudInstance).mockReturnValue(false);
			});

			it("should return the organization's own key when it has one", async () => {
				keysByOrg({
					[mockOrgId]: { key: "org-key" },
					[SYSTEM_ORG_ID]: { key: "system-key" },
				});

				const result = await getApiKeyByQuota(quotaOf(0), mockOrgId, mockVendor);

				expect(result).toEqual({ apiKey: { key: "org-key" }, quotaUsed: false });
			});

			it("should not fall back to the system key when the organization has its own", async () => {
				keysByOrg({
					[mockOrgId]: { key: "org-key" },
					[SYSTEM_ORG_ID]: { key: "system-key" },
				});

				await getApiKeyByQuota(quotaOf(0), mockOrgId, mockVendor);

				expect(db.organization.getOrganizationApiKey).not.toHaveBeenCalledWith(
					SYSTEM_ORG_ID,
					mockVendor,
				);
			});

			it("should fall back to the system key when the organization has none", async () => {
				// The documented self-hosted setup: keys come from the root .env, which
				// seeds them into the system organization.
				keysByOrg({ [mockOrgId]: null, [SYSTEM_ORG_ID]: { key: "system-key" } });

				const result = await getApiKeyByQuota(quotaOf(0), mockOrgId, mockVendor);

				expect(result).toEqual({ apiKey: { key: "system-key" }, quotaUsed: false });
			});

			it("should treat an empty stored key as missing and fall back", async () => {
				// Seeding creates a row per vendor even when its .env variable is unset.
				keysByOrg({ [mockOrgId]: { key: "" }, [SYSTEM_ORG_ID]: { key: "system-key" } });

				const result = await getApiKeyByQuota(quotaOf(0), mockOrgId, mockVendor);

				expect(result).toEqual({ apiKey: { key: "system-key" }, quotaUsed: false });
			});

			it("should never charge quota on a local instance", async () => {
				keysByOrg({ [mockOrgId]: null, [SYSTEM_ORG_ID]: { key: "system-key" } });

				const result = await getApiKeyByQuota(
					quotaOf(100),
					mockOrgId,
					mockVendor,
				);

				expect(result.quotaUsed).toBe(false);
			});

			it("should throw error if system organization ID is not found", async () => {
				vi.mocked(db.organization.getOrganizationApiKey).mockResolvedValue(null);
				vi.mocked(db.system.getSystemOrganizationId).mockResolvedValue(null);

				await expect(
					getApiKeyByQuota(quotaOf(0), mockOrgId, mockVendor),
				).rejects.toThrow("System organization ID not found in database");
			});

			it("should throw error if neither the organization nor the system has a key", async () => {
				keysByOrg({ [mockOrgId]: null, [SYSTEM_ORG_ID]: null });

				await expect(
					getApiKeyByQuota(quotaOf(0), mockOrgId, mockVendor),
				).rejects.toThrow(`System API key not found for ${mockVendor}`);
			});

			it("should throw error if the only key found is empty", async () => {
				keysByOrg({ [mockOrgId]: { key: "" }, [SYSTEM_ORG_ID]: { key: "" } });

				await expect(
					getApiKeyByQuota(quotaOf(0), mockOrgId, mockVendor),
				).rejects.toThrow(`System API key not found for ${mockVendor}`);
			});
		});
	});
});
