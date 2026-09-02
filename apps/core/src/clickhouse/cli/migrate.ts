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
		throw new MigrationError("An applied migration was edited. Add a new migration instead.");
	}

	if (plan.missing.length > 0) {
		for (const name of plan.missing) console.error(`MISSING ${name}: applied, but no file`);
		throw new MigrationError("Recorded history has no file on disk. This needs a human.");
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
	.catch((error) => {
		// Loud on purpose. The script this replaces swallowed every statement error and
		// exited 0, so a fresh environment silently got no schema at all.
		console.error(
			error instanceof MigrationError
				? `ClickHouse migration failed:\n${error.message}`
				: error,
		);
		process.exitCode = 1;
	})
	// Setting exitCode and closing the client, rather than calling process.exit(), so the
	// failure message is fully flushed first: ClickHouse's syntax errors run to kilobytes
	// and a hard exit can truncate exactly the output this command exists to produce.
	.finally(() => clickhouseClient.close());
