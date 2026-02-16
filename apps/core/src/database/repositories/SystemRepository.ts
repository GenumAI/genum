import type { PrismaClient } from "@/prisma";

export enum SYSTEM_CONFIG_KEY {
	SYSTEM_ORG_ID = "system.organization.id",
	SYSTEM_PRJ_ID = "system.project.id",
	SYSTEM_USER_ID = "system.user.id",
}

/**
 * System Repository
 *
 * Data access layer for system configuration.
 * Contains only methods for reading/writing system config - no business logic.
 */
export class SystemRepository {
	private prisma: PrismaClient;
	private systemOrganizationId: number | null;
	private systemProjectId: number | null;
	private systemUserId: number | null;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
		this.systemOrganizationId = null;
		this.systemProjectId = null;
		this.systemUserId = null;
	}

	/**
	 * Get system organization ID from config (cached)
	 */
	public async getSystemOrganizationId(): Promise<number | null> {
		if (this.systemOrganizationId) {
			return this.systemOrganizationId;
		}

		const systemOrganization = await this.prisma.systemConfig.findUnique({
			where: {
				key: SYSTEM_CONFIG_KEY.SYSTEM_ORG_ID,
			},
		});

		this.systemOrganizationId = systemOrganization ? Number(systemOrganization.value) : null;

		return this.systemOrganizationId;
	}

	/**
	 * Get system project ID from config (cached)
	 */
	public async getSystemProjectId(): Promise<number | null> {
		if (this.systemProjectId) {
			return this.systemProjectId;
		}

		const systemProject = await this.prisma.systemConfig.findUnique({
			where: {
				key: SYSTEM_CONFIG_KEY.SYSTEM_PRJ_ID,
			},
		});

		this.systemProjectId = systemProject ? Number(systemProject.value) : null;

		return this.systemProjectId;
	}

	/**
	 * Get system user ID from config (cached)
	 */
	public async getSystemUserId(): Promise<number | null> {
		if (this.systemUserId) {
			return this.systemUserId;
		}

		const systemUserId = await this.prisma.systemConfig.findUnique({
			where: {
				key: SYSTEM_CONFIG_KEY.SYSTEM_USER_ID,
			},
		});

		this.systemUserId = systemUserId ? Number(systemUserId.value) : null;

		return this.systemUserId;
	}

	public async createSystemOrganization() {
		// create system organization
		const systemOrganization = await this.prisma.organization.create({
			data: {
				name: "SYSTEM",
				description: "System organization for internal prompts",
				personal: false,
				quota: {
					create: {
						balance: 0,
					},
				},
				projects: {
					create: {
						name: "PROMPTS",
						description: "System project for internal prompts",
						initial: true,
					},
				},
			},
			include: {
				projects: true,
			},
		});

		// add system organization ID config
		await this.prisma.systemConfig.create({
			data: {
				key: SYSTEM_CONFIG_KEY.SYSTEM_ORG_ID,
				value: systemOrganization.id.toString(),
			},
		});

		// add system project ID config
		await this.prisma.systemConfig.create({
			data: {
				key: SYSTEM_CONFIG_KEY.SYSTEM_PRJ_ID,
				value: systemOrganization.projects[0].id.toString(),
			},
		});

		return systemOrganization;
	}

	/**
	 * Get system user entity from database
	 */
	public async getSystemUser() {
		const systemUserId = await this.getSystemUserId();
		if (systemUserId) {
			return await this.prisma.user.findUnique({
				where: { id: systemUserId },
			});
		}

		return null;
	}

	/**
	 * Set system config value
	 */
	public async setSystemConfigValue(key: SYSTEM_CONFIG_KEY, value: string) {
		return await this.prisma.systemConfig.upsert({
			where: { key },
			create: { key, value },
			update: { value },
		});
	}

	/**
	 * Get system config value by key
	 */
	public async getSystemConfigValue(key: SYSTEM_CONFIG_KEY): Promise<string | null> {
		const config = await this.prisma.systemConfig.findUnique({
			where: { key },
		});

		return config?.value ?? null;
	}
}
