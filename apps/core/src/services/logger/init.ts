import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { clickhouseClient, clickhouseDatabase } from "./logger";

/**
 * Initialize ClickHouse database and tables.
 * Reads init.sql and executes it through the ClickHouse client.
 */
export async function initializeClickHouse(): Promise<void> {
	try {
		// Read init.sql file - try multiple possible paths
		let initSql: string;

		// Paths to try (in order of preference):
		// 1. Relative to compiled output (production: dist/services/logger -> ../../clickhouse)
		// 2. Relative to source (development: src/services/logger -> ../../clickhouse)
		// 3. From process.cwd() assuming we're in apps/core directory
		const possiblePaths = [
			join(__dirname, "../../../clickhouse/init.sql"), // compiled
			resolve(process.cwd(), "clickhouse/init.sql"), // from core dir
			resolve(process.cwd(), "apps/core/clickhouse/init.sql"), // from monorepo root
		];

		let initSqlPath: string | null = null;
		for (const path of possiblePaths) {
			try {
				await readFile(path, "utf-8");
				initSqlPath = path;
				break;
			} catch {
				// Try next path
			}
		}

		if (!initSqlPath) {
			throw new Error(`Could not find init.sql file. Tried: ${possiblePaths.join(", ")}`);
		}

		initSql = await readFile(initSqlPath, "utf-8");

		const dbName = clickhouseDatabase;
		if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
			throw new Error(`Invalid ClickHouse DB name: ${dbName}`);
		}
		// Replace DB placeholder before executing
		initSql = initSql.replace(/{{DB_NAME}}/g, dbName);

		// Split SQL by semicolons and filter out empty statements
		// Handle multi-line statements properly
		const statements = initSql
			.split(";")
			.map((stmt) => stmt.trim())
			.filter((stmt) => {
				// Remove comments and empty lines
				const lines = stmt.split("\n").map((line) => line.trim());
				const nonCommentLines = lines.filter(
					(line) => line.length > 0 && !line.startsWith("--"),
				);
				return nonCommentLines.length > 0;
			});

		// Execute each statement
		for (const statement of statements) {
			if (statement.trim()) {
				try {
					// Use query() for DDL statements - it works for both DDL and DML
					// For DDL, format is optional but doesn't hurt
					await clickhouseClient.query({
						query: statement,
						format: "JSONEachRow",
						clickhouse_settings: {
							wait_end_of_query: 1,
						},
					});
				} catch (error: unknown) {
					// Ignore "already exists" errors, but log others
					const errorMsg = error instanceof Error ? error.message : String(error);
					if (
						!errorMsg.includes("already exists") &&
						!errorMsg.includes("Table") &&
						!errorMsg.includes("exists") &&
						!errorMsg.includes("Database")
					) {
						console.warn(`Warning executing ClickHouse init statement: ${errorMsg}`);
						console.warn(`Statement: ${statement.substring(0, 100)}...`);
					}
				}
			}
		}

		console.log("ClickHouse database initialized successfully");
	} catch (error) {
		console.error("Error initializing ClickHouse:", error);
		// Don't throw - allow app to start even if ClickHouse init fails
		// (might be intentional if tables already exist or ClickHouse is not available)
	}
}
