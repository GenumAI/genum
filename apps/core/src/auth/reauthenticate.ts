import type { NextFunction, Request, Response } from "express";
import { db } from "@/database/db";
import { verifyPassword } from "@/auth/local/password";
import { isLocalInstance } from "@/utils/env";
import { requireRecentAuthentication } from "./step-up";

/**
 * Proof that the caller is present RIGHT NOW, for an action that destroys their
 * account.
 *
 * The dispatch is EXCLUSIVE, and mirrors the way checkJwt already splits the two
 * instance types. It is deliberately not a fallback:
 *
 *   cloud → the auth_time claim only. A password is refused even when correct,
 *           and UserCredential is never read. Auth0 owns credentials in cloud
 *           mode. If a password were accepted here as a second chance, anyone
 *           could skip the step-up entirely by supplying one, which turns the
 *           strongest check in this feature into the weakest.
 *
 *   local → the caller's own password. There is no identity provider and no
 *           access token, so a missing auth_time claim is not a signal at all.
 *           The capability has to exist for the person themselves: on a
 *           self-hosted instance an ordinary employee cannot run the operator
 *           CLI, and needing to ask an administrator to close your own account
 *           is not self-service.
 */

/**
 * One message for every local failure. This sits on a destructive endpoint, so
 * the answer must not tell a caller whether the account has no credential, or
 * whether the password was merely wrong.
 */
const LOCAL_REFUSAL = {
	error: "reauthentication_required",
	detail: "Enter your current password to confirm this action.",
} as const;

export async function requireReauthentication(
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> {
	if (!isLocalInstance()) {
		requireRecentAuthentication(req, res, next);
		return;
	}

	// Read from the body, never echoed anywhere: not into a log, an error, or an
	// audit row.
	const password = (req.body as { password?: unknown } | undefined)?.password;
	if (typeof password !== "string" || password.length === 0) {
		res.status(401).json(LOCAL_REFUSAL);
		return;
	}

	const credential = await db.users.getUserCredential(req.genumMeta.ids.userID);
	if (!credential?.passwordHash) {
		res.status(401).json(LOCAL_REFUSAL);
		return;
	}

	if (!(await verifyPassword(password, credential.passwordHash))) {
		res.status(401).json(LOCAL_REFUSAL);
		return;
	}

	next();
}
