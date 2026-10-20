import type { Response } from "express";
import { db } from "@/database/db";

/** Default error when model is disabled for the organization. */
const MODEL_DISABLED_MESSAGE =
	"This model is disabled for your organization. Please contact your administrator.";

/**
 * Ensures the given model is available to the organization: global or reachable
 * through one of its own provider keys, and not disabled.
 * Sends 400 with error and returns false if it is not; returns true otherwise.
 */
export async function ensureModelEnabledForOrg(
	orgId: number,
	modelId: number,
	res: Response,
	customMessage?: string,
): Promise<boolean> {
	const isAvailable = await db.languageModels.isModelAvailableForOrg(orgId, modelId);
	if (!isAvailable) {
		res.status(400).json({
			error: customMessage ?? MODEL_DISABLED_MESSAGE,
		});
		return false;
	}
	return true;
}
