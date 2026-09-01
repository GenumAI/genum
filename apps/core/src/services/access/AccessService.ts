import type { AiVendor, OrganizationQuota } from "@/prisma";
import { db } from "@/database/db";
import { isCloudInstance } from "@/utils/env";
import { HttpError } from "@/utils/errors";

export async function checkPromptAccess(promptId: number, projectId: number) {
	const prompt = await db.prompts.getPromptById(promptId);
	if (!prompt) {
		// prompt not found
		throw new HttpError(404, "Prompt is not found");
	} else if (prompt.projectId === projectId) {
		// prompt found and belongs to project
		return prompt;
	} else {
		throw new HttpError(404, "Prompt is not found");
	}
}

export async function checkPlaceholderAccess(placeholderId: number, promptId: number) {
	const placeholder = await db.placeholders.getPlaceholderByIDAndPromptId(
		placeholderId,
		promptId,
	);
	if (!placeholder) {
		throw new HttpError(404, "Placeholder is not found");
	}
	return placeholder;
}

export async function checkTestcaseAccess(testcaseId: number, projectId: number) {
	const testcase = await db.testcases.getTestcaseByID(testcaseId);
	if (!testcase) {
		throw new HttpError(404, "Testcase is not found");
	} else if (testcase.prompt.projectId === projectId) {
		return testcase;
	} else {
		throw new HttpError(404, "Testcase is not found");
	}
}

/**
 * The system organization holds Genum's own provider keys, seeded from the root .env.
 * A row is created per vendor even when its variable is unset, so an empty key means
 * "not configured" just as much as a missing row does.
 */
async function getSystemApiKey(vendor: AiVendor) {
	const systemId = await db.system.getSystemOrganizationId();
	if (!systemId) {
		throw new Error("System organization ID not found in database");
	}
	const systemApiKey = await db.organization.getOrganizationApiKey(systemId, vendor);
	if (!systemApiKey?.key) {
		throw new Error(`System API key not found for ${vendor}`);
	}

	return systemApiKey;
}

export async function getApiKeyByQuota(quota: OrganizationQuota, orgId: number, vendor: AiVendor) {
	if (isCloudInstance()) {
		// Genum foots the bill while the organization still has quota, so that new users
		// can run prompts before wiring up any keys of their own.
		if (quota.balance > 0) {
			return { apiKey: await getSystemApiKey(vendor), quotaUsed: true };
		}

		// Quota spent - the organization runs on its own key from here on.
		const userApiKey = await db.organization.getOrganizationApiKey(orgId, vendor);
		if (!userApiKey) {
			throw new Error(`User API key not found for ${vendor}`);
		}
		return { apiKey: userApiKey, quotaUsed: false };
	}

	// Self-hosted: there is no quota to spend and nobody to bill, so an organization's
	// own key always wins. The system key is the fallback that keeps the documented
	// .env setup working for organizations that never configured one.
	const ownApiKey = await db.organization.getOrganizationApiKey(orgId, vendor);
	if (ownApiKey?.key) {
		return { apiKey: ownApiKey, quotaUsed: false };
	}

	return { apiKey: await getSystemApiKey(vendor), quotaUsed: false };
}
