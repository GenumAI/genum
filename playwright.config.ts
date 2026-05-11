import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filename: string, override = false): void {
	const filePath = path.resolve(process.cwd(), filename);
	if (!fs.existsSync(filePath)) return;

	const content = fs.readFileSync(filePath, "utf-8");
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const idx = line.indexOf("=");
		if (idx <= 0) continue;

		const key = line.slice(0, idx).trim();
		const value = line
			.slice(idx + 1)
			.trim()
			.replace(/^['"]|['"]$/g, "");

		if (!key) continue;
		if (!override && process.env[key] !== undefined) continue;
		process.env[key] = value;
	}
}

loadEnvFile(".env");
loadEnvFile(".env.e2e", true);

const isCI = Boolean(process.env.CI);
const webBaseUrl =
	process.env.E2E_WEB_URL ??
	(process.env.E2E === "true" ? "http://localhost:4080" : "http://localhost:3080");
const authStatePath = "e2e/.auth/state.json";

export default defineConfig({
	testDir: "./e2e/tests",
	timeout: 90_000,
	expect: {
		timeout: 15_000,
	},
	fullyParallel: false,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: isCI ? 1 : undefined,

	use: {
		baseURL: webBaseUrl,
		headless: true,
		trace: "retain-on-failure",
		video: "on",
		screenshot: "off",
	},

	projects: [
		{
			name: "setup",
			testMatch: /auth\.setup\.ts/,
		},
		{
			name: "chromium",
			use: {
				storageState: authStatePath,
			},
			dependencies: ["setup"],
		},
	],
});
