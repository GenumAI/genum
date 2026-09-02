import "dotenv/config";
import { join } from "node:path";
import { env } from "@/env";
import { clickhouseClient, createAdminClickhouseClient } from "@/services/logger/logger";
import { applyPending, buildPlan, ensureDatabase, MigrationError } from "../migrate";

const MIGRATIONS_DIR = join(__dirname, "../../../clickhouse/migrations");

async function main() {
	const database = env.CLICKHOUSE_DB;
	const admin = createAdminClickhouseClient();

	try {
		await ensureDatabase(admin, database);
	} finally {
		await admin.close();
	}

	const plan = await buildPlan(MIGRATIONS_DIR, clickhouseClient, database);

	if (plan.drifted.length > 0) {
		for (const entry of plan.drifted) {
			console.error(
				`DRIFT ${entry.name}: applied as ${entry.recorded.slice(0, 12)}, ` +
					`file is now ${entry.actual.slice(0, 12)}`,
			);
		}
		console.error("An applied migration was edited. Add a new migration instead.");
		process.exit(1);
	}

	if (plan.missing.length > 0) {
		for (const name of plan.missing) console.error(`MISSING ${name}: applied, but no file`);
		console.error("Recorded history has no file on disk. This needs a human.");
		process.exit(1);
	}

	if (plan.pending.length === 0) {
		console.log(`ClickHouse schema is up to date (database: ${database}).`);
		return;
	}

	const applied = await applyPending(clickhouseClient, database, plan);
	for (const name of applied) console.log(`applied ${name}`);
	console.log(`Applied ${applied.length} migration(s) to ${database}.`);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		// Loud on purpose. The script this replaces swallowed every statement error and
		// exited 0, so a fresh environment silently got no schema at all.
		console.error(
			error instanceof MigrationError
				? `ClickHouse migration failed:\n${error.message}`
				: error,
		);
		process.exit(1);
	});
