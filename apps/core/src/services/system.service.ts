import { hashPassword } from "@/auth/local/password";
import type { Database } from "@/database/db";
import { SYSTEM_CONFIG_KEY } from "@/database/repositories/SystemRepository";

/**
 * System Service
 *
 * Handles business logic for system-level entities:
 * - System organization and project
 * - System user
 * - System configuration
 */
export class SystemService {
	constructor(private db: Database) {}

	/**
	 * Create system organization with initial project
	 * Also saves organization and project IDs to system config
	 */
	async createSystemOrganization() {
		// Create system organization with project via repository
		const systemOrganization = await this.db.organization.createSystemOrganization(
			"SYSTEM",
			"System organization for internal prompts",
			"PROMPTS",
			"System project for internal prompts",
		);

		// Save system organization ID to config
		await this.db.system.setSystemConfigValue(
			SYSTEM_CONFIG_KEY.SYSTEM_ORG_ID,
			systemOrganization.id.toString(),
		);

		// Save system project ID to config
		await this.db.system.setSystemConfigValue(
			SYSTEM_CONFIG_KEY.SYSTEM_PRJ_ID,
			systemOrganization.projects[0].id.toString(),
		);

		return systemOrganization;
	}

	/**
	 * Create system/admin user with proper credentials
	 * Uses ADMIN_EMAIL and ADMIN_PASSWORD from env
	 */
	async createSystemUser(adminEmail: string, adminPassword: string) {
		// Hash password before creating user
		const passwordHash = await hashPassword(adminPassword);

		// Create admin user via repository with proper credentials
		const systemUser = await this.db.users.createLocalUser(adminEmail, "system", passwordHash);

		await this.db.system.setSystemConfigValue(
			SYSTEM_CONFIG_KEY.SYSTEM_USER_ID,
			systemUser.id.toString(),
		);

		return systemUser;
	}

	/**
	 * Create system organization if it doesn't exist
	 * @returns system organization ID
	 */
	async ensureSystemOrganizationExists(): Promise<number> {
		const systemOrganizationId = await this.db.system.getSystemOrganizationId();

		if (systemOrganizationId) {
			console.log(`System organization already exists (ID: ${systemOrganizationId})`);
			return systemOrganizationId;
		}

		console.log("Creating system organization...");
		const createdOrganization = await this.createSystemOrganization();
		console.log(`System organization created (ID: ${createdOrganization.id})`);
		return createdOrganization.id;
	}

	/**
	 * Ensure system user exists, with migration from old "SYSTEM_USER" if needed
	 *
	 * Migration logic (backward compatibility with v1.3.0):
	 * 1. Check if systemConfig has SYSTEM_USER_ID -> user properly configured
	 * 2. If not, check if old "SYSTEM_USER" exists in database -> migrate it
	 * 3. If not, create new admin user
	 *
	 * @returns system user ID
	 */
	async ensureSystemUserExists(adminEmail: string, adminPassword: string): Promise<number> {
		// Check if system user is already configured in systemConfig
		const systemUserId = await this.db.system.getSystemUserId();
		if (systemUserId) {
			const systemUser = await this.db.system.getSystemUser();
			if (systemUser) {
				console.log(`System user already exists (ID: ${systemUser.id})`);
				return systemUser.id;
			}
		}

		// Migration: check if old "SYSTEM_USER" exists (backward compatibility with v1.3.0)
		const oldSystemUser = await this.db.users.getUserByEmail("SYSTEM_USER");
		if (oldSystemUser) {
			console.log(`🔄 Migrating old system user (ID: ${oldSystemUser.id}) to admin...`);

			// Hash password
			const passwordHash = await hashPassword(adminPassword);

			// Update user email and name
			await this.db.users.updateUserEmailAndName(oldSystemUser.id, adminEmail, "system");

			// Create or update credentials
			const existingCredential = await this.db.users.getUserCredential(oldSystemUser.id);
			if (existingCredential) {
				await this.db.users.updateUserCredential(oldSystemUser.id, passwordHash);
			} else {
				await this.db.users.createUserCredential(oldSystemUser.id, passwordHash);
			}

			// Save to systemConfig
			await this.db.system.setSystemConfigValue(
				SYSTEM_CONFIG_KEY.SYSTEM_USER_ID,
				oldSystemUser.id.toString(),
			);

			console.log(`✅ Migrated system user to: ${adminEmail}`);
			return oldSystemUser.id;
		}

		// No existing user - create new admin user
		console.log("Creating new system user...");
		const createdUser = await this.createSystemUser(adminEmail, adminPassword);
		console.log(`System user created (ID: ${createdUser.id})`);
		return createdUser.id;
	}
}
