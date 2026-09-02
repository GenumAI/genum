import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClickHouseClient } from "@clickhouse/client";
import { splitStatements } from "./split";
import {
	type AppliedMigration,
	type MigrationFile,
	type MigrationPlan,
	migrationChecksum,
	planMigrations,
} from "./plan";

export const MIGRATIONS_TABLE = "_migrations";

export class MigrationError extends Error {}

/**
 * The database name is interpolated into DDL that cannot be parameterised, so it is
 * validated rather than escaped -- same rule the previous init script applied.
 */
export function assertSafeDatabaseName(database: string): void {
	if (!/^[A-Za-z0-9_]+$/.test(database)) {
		throw new MigrationError(`Invalid ClickHouse database name: ${database}`);
	}
}

/**
 * Substitutes `{{DB_NAME}}` and splits the result into executable statements -- but
 * checksums `file.sql`, the RAW text, before substitution.
 *
 * The checksum and the statements are deliberately computed from different inputs: the
 * checksum must be the same in every environment regardless of what the database is
 * called there, so it is taken before substitution; the statements sent to the server
 * must carry the real database name, so they are taken after.
 */
export function prepareMigration(
	file: MigrationFile,
	database: string,
): { statements: string[]; checksum: string } {
	const sql = file.sql.replace(/{{DB_NAME}}/g, database);
	return {
		statements: splitStatements(sql),
		checksum: migrationChecksum(file.sql),
	};
}

export async function readMigrationFiles(dir: string): Promise<MigrationFile[]> {
	const entries = await readdir(dir);
	const names = entries.filter((name) => name.endsWith(".sql")).sort();

	const files: MigrationFile[] = [];
	for (const name of names) {
		files.push({ name, sql: await readFile(join(dir, name), "utf-8") });
	}
	return files;
}

export async function ensureDatabase(admin: ClickHouseClient, database: string): Promise<void> {
	assertSafeDatabaseName(database);
	await admin.command({ query: `CREATE DATABASE IF NOT EXISTS ${database}` });
	// ReplacingMergeTree because ClickHouse enforces no uniqueness on insert: a retry or
	// two runners racing must not leave two rows that both count. Reads use FINAL.
	await admin.command({
		query: `CREATE TABLE IF NOT EXISTS ${database}.${MIGRATIONS_TABLE}
			(
				name         String,
				checksum     String,
				applied_at   DateTime64(3) DEFAULT now64(),
				execution_ms UInt32
			)
			ENGINE = ReplacingMergeTree(applied_at)
			ORDER BY name`,
	});
}

export async function readAppliedMigrations(
	client: ClickHouseClient,
	database: string,
): Promise<AppliedMigration[]> {
	// Validated here rather than only in the callers that write: this query interpolates
	// the name too, and `buildPlan` reaches it without passing through `ensureDatabase`
	// or `applyPending` -- which is exactly what a read-only `status` command does.
	assertSafeDatabaseName(database);

	const resultSet = await client.query({
		query: `SELECT name, checksum FROM ${database}.${MIGRATIONS_TABLE} FINAL ORDER BY name`,
		format: "JSONEachRow",
	});
	return await resultSet.json<AppliedMigration>();
}

export async function buildPlan(
	dir: string,
	client: ClickHouseClient,
	database: string,
): Promise<MigrationPlan> {
	const files = await readMigrationFiles(dir);
	const applied = await readAppliedMigrations(client, database);
	return planMigrations(files, applied);
}

/**
 * Applies `plan.pending` in order and returns the names applied.
 *
 * Stops at the first failing statement and throws: ClickHouse has no transactional DDL,
 * so continuing past a failure would leave the schema in a state nobody described. The
 * failed migration is deliberately NOT recorded, so the next run retries it.
 */
export async function applyPending(
	client: ClickHouseClient,
	database: string,
	plan: MigrationPlan,
): Promise<string[]> {
	assertSafeDatabaseName(database);

	if (plan.drifted.length > 0 || plan.missing.length > 0) {
		throw new MigrationError(
			"Refusing to migrate: the recorded history and the files on disk disagree.",
		);
	}

	const applied: string[] = [];

	for (const file of plan.pending) {
		const { statements, checksum } = prepareMigration(file, database);
		const startedAt = Date.now();

		for (const [index, statement] of statements.entries()) {
			try {
				await client.command({ query: statement });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new MigrationError(
					`${file.name} failed at statement ${index + 1} of ${statements.length}:\n` +
						`${statement.slice(0, 300)}\n\nClickHouse said: ${message}`,
				);
			}
		}

		await client.insert({
			table: `${database}.${MIGRATIONS_TABLE}`,
			values: [
				{
					name: file.name,
					checksum,
					execution_ms: Date.now() - startedAt,
				},
			],
			format: "JSONEachRow",
		});

		applied.push(file.name);
	}

	return applied;
}
