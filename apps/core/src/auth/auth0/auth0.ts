import { isLocalInstance } from "@/utils/env";
import { auth } from "express-oauth2-jwt-bearer";
import type { NextFunction, Request, Response } from "express";
import { type GenumMetadata, extractMetadataIds } from "../jwt";
import { env } from "@/env";

const userIDClaimKey: string = env.AUTH0_USERID_CLAIM || "sub";

const auth0Middleware = isLocalInstance()
	? null
	: auth({
			issuerBaseURL: `https://${env.AUTH0_DOMAIN}/`,
			audience: env.AUTH0_AUDIENCE,
			tokenSigningAlg: "RS256",
		});

function getMetadata(req: Request): GenumMetadata["ids"] {
	const authID = req.auth?.payload.sub;
	const userID = req.auth?.payload[userIDClaimKey] as number;

	if (!authID) {
		throw new Error("sub not found");
	}
	if (!userID) {
		throw new Error("userID not found");
	}

	return extractMetadataIds(req, userID);
}

export function auth0AuthMiddleware(req: Request, res: Response, next: NextFunction) {
	if (isLocalInstance()) {
		return next();
	}

	if (!auth0Middleware) {
		return res.status(500).json({ error: "Auth0 middleware not initialized" });
	}

	auth0Middleware(req, res, (err: string | null) => {
		if (err) {
			// Handle auth errors from Auth0 middleware
			return res.status(401).json({ error: err });
		}
		try {
			req.genumMeta = {} as GenumMetadata;
			req.genumMeta.ids = getMetadata(req);
			next();
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Unknown error";
			res.status(401).json({ error: message });
		}
	});
}
