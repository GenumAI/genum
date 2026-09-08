import { describe, it, expect, afterEach, vi } from "vitest";
import express, { type Express } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// The limiters read their budgets from env at import time, so the schema's defaults are pinned
// here rather than loaded from the ambient environment -- otherwise a developer's .env would
// decide how many attempts these tests expect.
vi.mock("@/env", () => ({
	env: {
		RATE_LIMIT_CREDENTIAL_WINDOW_MS: 15 * 60 * 1000,
		RATE_LIMIT_CREDENTIAL_MAX: 10,
		RATE_LIMIT_API_WINDOW_MS: 60 * 1000,
		RATE_LIMIT_API_MAX: 600,
		RATE_LIMIT_GLOBAL_WINDOW_MS: 60 * 1000,
		RATE_LIMIT_GLOBAL_MAX: 1000,
	},
}));

import { CREDENTIAL_LIMIT, createApiRateLimiter, createCredentialRateLimiter } from "./rate-limit";

/**
 * The limiters read `req.ip`, which Express derives from the socket and the
 * trust-proxy setting, so these run against a real server rather than a faked
 * request. One trusted hop lets each test present a distinct client address
 * through X-Forwarded-For; without it every request would arrive as 127.0.0.1
 * and per-IP keying would be untestable.
 */
function buildApp(): Express {
	const app = express();
	app.set("trust proxy", 1);

	const credentialLimiter = createCredentialRateLimiter();
	app.use("/auth/local/login", credentialLimiter);
	app.use("/auth/local/register", credentialLimiter);
	app.use("/api/v1", createApiRateLimiter());

	app.use((_req, res) => {
		res.status(200).json({ ok: true });
	});

	return app;
}

let close: () => Promise<void>;

async function startApp(): Promise<string> {
	const server = await new Promise<Server>((resolve) => {
		const s: Server = buildApp().listen(0, "127.0.0.1", () => resolve(s));
	});
	close = () =>
		new Promise<void>((resolve) => {
			server.close(() => resolve());
		});

	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function post(baseUrl: string, path: string, ip: string): Promise<Response> {
	return fetch(`${baseUrl}${path}`, {
		method: "POST",
		headers: { "x-forwarded-for": ip },
	});
}

afterEach(async () => {
	await close?.();
});

describe("credential rate limiter", () => {
	it("blocks further attempts once the budget for that IP is spent", async () => {
		const baseUrl = await startApp();

		const statuses: number[] = [];
		for (let attempt = 0; attempt < CREDENTIAL_LIMIT + 1; attempt++) {
			const res = await post(baseUrl, "/auth/local/login", "203.0.113.10");
			statuses.push(res.status);
		}

		expect(statuses.slice(0, CREDENTIAL_LIMIT)).toEqual(
			Array.from({ length: CREDENTIAL_LIMIT }, () => 200),
		);
		expect(statuses.at(-1)).toBe(429);
	});

	it("answers a blocked request with the shared { error } shape", async () => {
		const baseUrl = await startApp();

		let res = await post(baseUrl, "/auth/local/login", "203.0.113.11");
		for (let attempt = 0; attempt < CREDENTIAL_LIMIT; attempt++) {
			res = await post(baseUrl, "/auth/local/login", "203.0.113.11");
		}

		expect(res.status).toBe(429);
		await expect(res.json()).resolves.toEqual({ error: expect.any(String) });
	});

	it("shares one budget between login and register", async () => {
		// Otherwise the two endpoints can be alternated to double the bcrypt work
		// an attacker gets for free.
		const baseUrl = await startApp();

		for (let attempt = 0; attempt < CREDENTIAL_LIMIT; attempt++) {
			await post(baseUrl, "/auth/local/login", "203.0.113.12");
		}

		const res = await post(baseUrl, "/auth/local/register", "203.0.113.12");
		expect(res.status).toBe(429);
	});

	it("keys per IP, so one blocked client does not lock everyone out", async () => {
		const baseUrl = await startApp();

		for (let attempt = 0; attempt < CREDENTIAL_LIMIT + 1; attempt++) {
			await post(baseUrl, "/auth/local/login", "203.0.113.13");
		}

		const blocked = await post(baseUrl, "/auth/local/login", "203.0.113.13");
		const other = await post(baseUrl, "/auth/local/login", "198.51.100.7");

		expect(blocked.status).toBe(429);
		expect(other.status).toBe(200);
	});
});

describe("api rate limiter", () => {
	it("keeps its own budget, untouched by the credential limiter", async () => {
		// Machine traffic on /api/v1 must not be throttled because someone is
		// grinding the login form from the same address.
		const baseUrl = await startApp();

		for (let attempt = 0; attempt < CREDENTIAL_LIMIT + 1; attempt++) {
			await post(baseUrl, "/auth/local/login", "203.0.113.14");
		}

		const credential = await post(baseUrl, "/auth/local/login", "203.0.113.14");
		const api = await post(baseUrl, "/api/v1/prompts", "203.0.113.14");

		expect(credential.status).toBe(429);
		expect(api.status).toBe(200);
	});

	it("does not spend the credential budget", async () => {
		const baseUrl = await startApp();

		for (let attempt = 0; attempt < CREDENTIAL_LIMIT + 1; attempt++) {
			await post(baseUrl, "/api/v1/prompts", "203.0.113.15");
		}

		const credential = await post(baseUrl, "/auth/local/login", "203.0.113.15");
		expect(credential.status).toBe(200);
	});
});
