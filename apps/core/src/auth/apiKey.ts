import { db } from "@/database/db";
import { HttpError } from "@/utils/errors";
import { extractBearerToken } from "@/utils/http";

/**
 * Resolves a project API key from an `Authorization: Bearer <token>` header.
 *
 * Shared by every public surface that authenticates with a project key -- `/api/v1` and
 * OTLP ingest today. Deliberately one function and not one per surface: a second copy is
 * how one of them ends up missing a check the other got, and the check most likely to be
 * missed is the one that matters (a revoked key, a project since deleted).
 *
 * The status codes and messages are a public API's contract, unchanged from where this
 * lived in `apiv1.controller.ts`. A caller's collector reads them; do not reword them for
 * being terse.
 */
export async function resolveApiKey(authorizationHeader: string | undefined) {
	const apiKey = extractBearerToken(authorizationHeader);
	if (!apiKey) {
		throw new HttpError(
			401,
			"Invalid or missing Authorization header. Expected: Bearer <token>",
		);
	}

	const key = await db.project.getProjectApiKeyByToken(apiKey);
	if (!key) {
		throw new HttpError(401, "Invalid API key");
	}

	const project = await db.project.getProjectbyApiKeyById(key.id);
	if (!project) {
		throw new HttpError(404, "Project not found");
	}

	return { project, key };
}
