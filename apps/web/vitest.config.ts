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
		// No `globals: true`: every test file imports describe/expect/it explicitly, and no
		// tsconfig declares the `vitest/globals` types -- turning this on would let a future
		// test lean on the globals and pass at runtime while `tsc -b` never catches it.
		environment: "node",
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
	},
});
