/// <reference types="vitest/config" />
import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Separate from `vite.config.ts` on purpose: the app config loads the React, SVGR and
 * env-mapper plugins, none of which a pure-function unit test needs. Only the `@` alias
 * is restated, because that is the one thing the sources under test rely on.
 */
export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
	},
});
