import "dotenv/config";
import { join } from "node:path";
import { env } from "@/env";
import { clickhouseClient, createAdminClickhouseClient } from "@/services/logger/logger";
import { buildPlan, ensureDatabase, readAppliedMigrations } from "../migrate";

const MIGRATIONS_DIR = join(__dirname, "../../../clickhouse/migrations");

async function main(): Promise<number> {
	const database = env.CLICKHOUSE_DB;
	const admin = createAdminClickhouseClient();

	try {
		await ensureDatabase(admin, database);
	} finally {
		await admin.close();
	}

	const plan = await buildPlan(MIGRATIONS_DIR, clickhouseClient, database);
	// The applied set is what makes this command an answer to "did the schema change go
	// in?". Without it the operator only learns what has NOT happened yet.
	const applied = await readAppliedMigrations(clickhouseClient, database);

	console.log(`database: ${database}`);
	console.log(`applied:  ${applied.length}`);
	for (const row of applied) console.log(`  - ${row.name}`);
	console.log(`pending:  ${plan.pending.length}`);
	for (const file of plan.pending) console.log(`  - ${file.name}`);
	console.log(`drifted:  ${plan.drifted.length}`);
	for (const entry of plan.drifted) console.log(`  - ${entry.name}`);
	console.log(`missing:  ${plan.missing.length}`);
	for (const name of plan.missing) console.log(`  - ${name}`);

	return plan.drifted.length > 0 || plan.missing.length > 0 ? 1 : 0;
}

main()
	.then((code) => process.exit(code))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
