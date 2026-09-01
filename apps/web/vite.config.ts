import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "node:path";
import { envMapper } from "./vite-plugin-env-mapper";

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
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@/layout": path.resolve(__dirname, "./src/layout"),
			"@/pages": path.resolve(__dirname, "./src/pages"),
			"@/components": path.resolve(__dirname, "./src/components"),
		},
	},
});
