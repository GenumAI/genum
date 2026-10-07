import "dotenv/config";
import { syncModels } from "./models";
import { createSystemPromptsIfNotExists, DEFAULT_SYSTEM_PROMPTS_DATA } from "./system-prompts";
import { migrateSystemPromptModels } from "./system-prompts/models";
import { db } from "@/database/db";
import {
	addSystemUserToOrganization,
	createLLMAPIKeysIfNotExists,
	createSystemOrganizationIfNotExists,
	createSystemUserIfNotExists,
} from "./organization";
import { prisma } from "@/database/prisma";

/**
 * main function to initialize database
 * creates all necessary system entities in the correct order
 */
async function main() {
	await syncModels();

	// System user creation now includes migration logic internally
	// (backward compatibility with v1.3.0 and earlier is handled in SystemService.ensureSystemUserExists)
	const systemUserId = await createSystemUserIfNotExists();
	const systemOrganizationId = await createSystemOrganizationIfNotExists();
	await addSystemUserToOrganization(systemUserId, systemOrganizationId);
	await createLLMAPIKeysIfNotExists(systemOrganizationId);
	await createSystemPromptsIfNotExists(systemUserId);
	await migrateSystemPromptModels(db, systemUserId, DEFAULT_SYSTEM_PROMPTS_DATA);
}

main()
	.catch((e) => {
		console.error("❌ Error during seeding:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
