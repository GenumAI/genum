import "dotenv/config";
import { initializeClickHouse } from "./init";

/**
 * Standalone script to initialize ClickHouse database.
 * Should be run once during deployment/setup, not on every server start.
 */
async function main() {
	console.log("🚀 Initializing ClickHouse database...");
	await initializeClickHouse();
	console.log("✅ ClickHouse database initialized successfully");
}

main()
	.then(() => {
		process.exit(0);
	})
	.catch((error) => {
		console.error("❌ ClickHouse initialization failed:", error);
		process.exit(1);
	});
