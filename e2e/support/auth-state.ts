import { request, type APIResponse } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { apiBaseUrl, authCredentialsPath, authStatePath, webBaseUrl } from "../config/env";
import type { E2EUser } from "./user-data";

const connectionRefusedMessage = () =>
	[
		`Cannot reach E2E API at ${apiBaseUrl}.`,
		"Start the required services before running Playwright:",
		"- Local mode: pnpm dev:infra:up && pnpm dev",
		"- Docker E2E mode: E2E=true pnpm exec playwright test",
	].join("\n");

async function registerUser(user: E2EUser): Promise<void> {
	const api = await request.newContext({ baseURL: apiBaseUrl });

	let response: APIResponse;
	try {
		response = await api.post("/auth/local/register", {
			data: {
				name: user.name,
				email: user.email,
				password: user.password,
			},
		});
	} catch (error) {
		await api.dispose();
		throw new Error(
			`${connectionRefusedMessage()}\n\nOriginal error: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	if (!response.ok()) {
		const body = await response.text();
		await api.dispose();
		throw new Error(`Register failed: ${response.status()} ${body}`);
	}

	await api.dispose();
}

export async function createAuthState(user: E2EUser): Promise<void> {
	const authDir = path.dirname(authStatePath);
	fs.mkdirSync(authDir, { recursive: true });

	await registerUser(user);

	const api = await request.newContext({ baseURL: apiBaseUrl });

	let loginResponse: APIResponse;
	try {
		loginResponse = await api.post("/auth/local/login", {
			data: {
				email: user.email,
				password: user.password,
			},
		});
	} catch (error) {
		await api.dispose();
		throw new Error(
			`${connectionRefusedMessage()}\n\nOriginal error: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	if (!loginResponse.ok()) {
		const body = await loginResponse.text();
		await api.dispose();
		throw new Error(`Login failed: ${loginResponse.status()} ${body}`);
	}

	const state = await api.storageState();
	const webOrigin = new URL(webBaseUrl).origin;
	const normalizedState = {
		...state,
		cookies: state.cookies.map((cookie) =>
			cookie.name === "sid"
				? {
						...cookie,
						secure: false,
						sameSite: "Lax" as const,
					}
				: cookie,
		),
		origins: [
			...state.origins.filter((origin) => origin.origin !== webOrigin),
			{
				origin: webOrigin,
				localStorage: [
					{
						name: "cookie-consent",
						value: "accepted",
					},
				],
			},
		],
	};
	fs.writeFileSync(authStatePath, JSON.stringify(normalizedState, null, 2));
	await api.dispose();

	fs.writeFileSync(authCredentialsPath, JSON.stringify(user, null, 2));
}
