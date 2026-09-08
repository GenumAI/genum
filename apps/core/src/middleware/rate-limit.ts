import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";

import { env } from "@/env";

/**
 * Everything mounted before `checkJwt` in routes.ts answers unauthenticated
 * callers: the credential endpoints, the admin bearer routes, the project
 * API-key surface and the mail integration. These limiters bound how hard one
 * client can hammer them.
 *
 * Each factory builds its own MemoryStore, so a caller who spends one budget
 * still has the others: a brute-force run against /auth/local must not be able
 * to lock a project's API traffic out.
 */

// All six are configurable through env.ts, because the right number depends on a deployment's
// shape -- how many users share an outbound address, whether a proxy sits in front -- and a
// limiter nobody can loosen is one an operator has to rip out instead of tune.

// Login and register both run bcrypt at AUTH_BCRYPT_ROUNDS, so every attempt
// costs real CPU whether or not the password matched. Ten per quarter hour
// leaves room for a person mistyping a password and none for credential
// stuffing.
export const CREDENTIAL_WINDOW_MS = env.RATE_LIMIT_CREDENTIAL_WINDOW_MS;
export const CREDENTIAL_LIMIT = env.RATE_LIMIT_CREDENTIAL_MAX;

// /api/v1 is machine traffic holding a project API key. A batch job bursts far
// past anything a browser does, so this is set to bound abuse, not to pace
// callers: 10 requests a second, sustained.
export const API_WINDOW_MS = env.RATE_LIMIT_API_WINDOW_MS;
export const API_LIMIT = env.RATE_LIMIT_API_MAX;

// Backstop for every other surface. A person driving the UI never comes close;
// it exists so a single client cannot occupy the event loop indefinitely.
export const GLOBAL_WINDOW_MS = env.RATE_LIMIT_GLOBAL_WINDOW_MS;
export const GLOBAL_LIMIT = env.RATE_LIMIT_GLOBAL_MAX;

// A 429 on a liveness probe restarts the container the limiter was protecting,
// so probes are never counted.
const UNMETERED_PATHS = new Set(["/health", "/healthz", "/readyz", "/livez"]);

// Matches the { error } shape every other guard on these routes returns.
const TOO_MANY_REQUESTS = { error: "Too many requests, please try again later." };

const shared = {
	standardHeaders: "draft-8",
	legacyHeaders: false,
	message: TOO_MANY_REQUESTS,
} as const;

/**
 * Strict, per-IP limiter for /auth/local login and register. One instance is
 * shared by both so the two cannot be alternated to double the budget.
 */
export function createCredentialRateLimiter(): RateLimitRequestHandler {
	return rateLimit({
		...shared,
		windowMs: CREDENTIAL_WINDOW_MS,
		limit: CREDENTIAL_LIMIT,
	});
}

export function createApiRateLimiter(): RateLimitRequestHandler {
	return rateLimit({
		...shared,
		windowMs: API_WINDOW_MS,
		limit: API_LIMIT,
	});
}

export function createGlobalRateLimiter(): RateLimitRequestHandler {
	return rateLimit({
		...shared,
		windowMs: GLOBAL_WINDOW_MS,
		limit: GLOBAL_LIMIT,
		skip: (req) => UNMETERED_PATHS.has(req.path),
	});
}
