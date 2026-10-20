import { AiVendor, type PrismaClient } from "@/prisma";
import type { CustomProviderApiKeyCreateType } from "@/services/validate";

export class ProviderKeysRepository {
	private prisma: PrismaClient;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	public async getOrganizationApiKeys(orgId: number) {
		const keys = await this.prisma.organizationApiKey.findMany({
			where: {
				organizationId: orgId,
			},
			select: {
				id: true,
				vendor: true,
				createdAt: true,
				updatedAt: true,
				publicKey: true,
			},
		});

		return keys;
	}

	public async addOrganizationApiKey(orgId: number, vendor: AiVendor, key: string) {
		// show 3 first and 3 last characters of the key
		const publicKey = `${key.slice(0, 3)}...${key.slice(-4)}`;
		return await this.prisma.organizationApiKey.upsert({
			where: {
				organizationId_vendor: {
					organizationId: orgId,
					vendor,
				},
			},
			update: {
				key,
				updatedAt: new Date(),
				publicKey: publicKey,
			},
			create: {
				organizationId: orgId,
				vendor,
				key,
				publicKey: publicKey,
			},
		});
	}

	public async deleteOrganizationApiKey(orgId: number, id: number) {
		return await this.prisma.organizationApiKey.delete({
			where: {
				organizationId: orgId,
				id: id,
			},
		});
	}

	public async getOrganizationApiKey(orgId: number, vendor: AiVendor) {
		return await this.prisma.organizationApiKey.findUnique({
			where: {
				organizationId_vendor: {
					organizationId: orgId,
					vendor,
				},
			},
		});
	}

	// ==================== Custom Provider Methods ====================

	/**
	 * Create or update the custom OpenAI-compatible provider (only one per org)
	 */
	public async upsertCustomProvider(orgId: number, data: CustomProviderApiKeyCreateType) {
		const publicKey = data.key ? `${data.key.slice(0, 3)}...${data.key.slice(-4)}` : "(no key)";

		return await this.prisma.organizationApiKey.upsert({
			where: {
				organizationId_vendor: {
					organizationId: orgId,
					vendor: data.vendor,
				},
			},
			update: {
				key: data.key || "",
				publicKey,
				name: data.name,
				baseUrl: data.baseUrl,
				updatedAt: new Date(),
			},
			create: {
				organizationId: orgId,
				vendor: data.vendor,
				key: data.key || "",
				publicKey,
				name: data.name,
				baseUrl: data.baseUrl,
			},
		});
	}

	/**
	 * Get the custom provider for an organization (if exists)
	 */
	public async getCustomProvider(orgId: number) {
		return await this.prisma.organizationApiKey.findUnique({
			where: {
				organizationId_vendor: {
					organizationId: orgId,
					vendor: AiVendor.CUSTOM_OPENAI_COMPATIBLE,
				},
			},
			include: {
				_count: {
					select: { languageModels: true },
				},
			},
		});
	}

	/**
	 * Get model IDs synced for a custom provider
	 */
	public async getCustomProviderModelIds(apiKeyId: number): Promise<number[]> {
		const models = await this.prisma.languageModel.findMany({
			where: { apiKeyId },
			select: { id: true },
		});

		return models.map((model) => model.id);
	}

	public deleteOrganizationApiKeyById(apiKeyId: number) {
		return this.prisma.organizationApiKey.delete({ where: { id: apiKeyId } });
	}

	/**
	 * Get API key by ID (with organization check)
	 */
	public async getApiKeyById(orgId: number, apiKeyId: number) {
		return await this.prisma.organizationApiKey.findUnique({
			where: {
				id: apiKeyId,
				organizationId: orgId,
			},
		});
	}

	/**
	 * Get API key with its synced language models
	 */
	public async getApiKeyWithModels(orgId: number, apiKeyId: number) {
		return await this.prisma.organizationApiKey.findUnique({
			where: {
				id: apiKeyId,
				organizationId: orgId,
			},
			include: {
				languageModels: {
					orderBy: { name: "asc" },
				},
			},
		});
	}
}
