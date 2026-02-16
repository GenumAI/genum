import { AiVendor, OrganizationRole } from "@/.generated/prisma-client/client";
import { db } from "@/database/db";
import { env } from "@/env";
import { OrganizationService } from "@/services/organization.service";
import { SystemService } from "@/services/system.service";

/**
 * create system organization if it doesn't exist
 */
export async function createSystemOrganizationIfNotExists() {
	const systemService = new SystemService(db);
	return await systemService.ensureSystemOrganizationExists();
}

/**
 * create system user if it doesn't exist
 * @returns system user ID
 */
export async function createSystemUserIfNotExists(): Promise<number> {
	const systemService = new SystemService(db);
	return await systemService.ensureSystemUserExists(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
}

const DEFAULT_SYSTEM_PROMPTS_DATA = [
	{
		vendor: AiVendor.OPENAI,
		key: env.OPENAI_KEY || "",
	},
	{
		vendor: AiVendor.ANTHROPIC,
		key: env.ANTHROPIC_KEY || "",
	},
	{
		vendor: AiVendor.GOOGLE,
		key: env.GEMINI_KEY || "",
	},
];

// LLM API keys
export async function createLLMAPIKeysIfNotExists(systemOrganizationId: number) {
	const llmApiKeys = await db.organization.getOrganizationApiKeys(systemOrganizationId);

	// compare llmApiKeys with DEFAULT_SYSTEM_PROMPTS_DATA
	const keysToCreate = DEFAULT_SYSTEM_PROMPTS_DATA.filter(
		(key) => !llmApiKeys.some((k) => k.vendor === key.vendor),
	);
	if (keysToCreate.length === 0) {
		console.log(`LLM API keys already exist, skipping...`);
		return;
	}

	console.log(`Creating ${keysToCreate.length} LLM API keys...`);
	for (const key of keysToCreate) {
		await db.organization.addOrganizationApiKey(systemOrganizationId, key.vendor, key.key);
		console.log(`LLM API key ${key.vendor} created`);
	}

	console.log(`${keysToCreate.length} LLM API keys created`);

	return;
}

export async function addSystemUserToOrganization(
	systemUserId: number,
	systemOrganizationId: number,
) {
	const member = await db.organization.getMemberByUserId(systemOrganizationId, systemUserId);
	if (member) {
		console.log(`System user already in the organization, skipping...`);
		return;
	}

	try {
		await new OrganizationService(db).addOrganizationMember(
			systemOrganizationId,
			systemUserId,
			OrganizationRole.ADMIN,
		);
		console.log(`System user added to the organization`);
	} catch (error) {
		console.error(`Error adding system user to the organization: ${error}`);
	}
}
