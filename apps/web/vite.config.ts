import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "node:path";
import { envMapper } from "./vite-plugin-env-mapper";

// Vendor code changes far less often than app code, so it is pinned into chunks of its own and
// survives a routine app deploy in the browser cache. react-dom and the router resolve hooks
// through react's shared internals, so those have to stay together: spread across chunks they bind
// to different React copies and every hook call throws at runtime.
//
// Only name a package here when it is BOTH eagerly imported and worth its own cache entry. Naming
// a lazy-only package backfires: Rollup merges chunks below its minimum size, so a shared few-line
// utility can land inside the named chunk, and the entry then statically imports the whole thing.
// That is measured, not hypothetical -- naming recharts pulled clsx in with it and put all 421 kB
// of charting on the boot path for one helper function.
//
// Three packages are therefore deliberately absent:
//   recharts, reachable only from the lazy dashboard;
//   monaco-editor, which lazily imports its own ~80 language grammars -- naming it collapses them
//     into one chunk, so opening the editor would fetch every grammar instead of the one in use;
//   @tanstack as a prefix, which would sweep react-table in beside react-query. react-query is
//     eager (main.tsx), so the whole group would be promoted onto the boot path even though
//     react-table is only ever reached from lazy pages.
// Rollup's automatic chunking already splits all three correctly.
const VENDOR_CHUNKS: Record<string, string[]> = {
	"vendor-react": ["react", "react-dom", "react-router", "react-router-dom", "scheduler"],
	"vendor-tanstack": ["@tanstack/react-query", "@tanstack/query-core"],
};

export default defineConfig({
	plugins: [
		react(),
		svgr({
			svgrOptions: {
				exportType: "default",
			},
			include: "**/*.svg",
		}),
		envMapper(),
	],
	server: {
		port: 3000,
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					for (const [chunk, packages] of Object.entries(VENDOR_CHUNKS)) {
						if (packages.some((pkg) => id.includes(`/node_modules/${pkg}/`))) {
							return chunk;
						}
					}
				},
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@/layout": path.resolve(__dirname, "./src/layout"),
			"@/pages": path.resolve(__dirname, "./src/pages"),
			"@/components": path.resolve(__dirname, "./src/components"),
		},
	},
});
