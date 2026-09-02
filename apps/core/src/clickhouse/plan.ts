import { createHash } from "node:crypto";

export type MigrationFile = { name: string; sql: string };
export type AppliedMigration = { name: string; checksum: string };

export type MigrationPlan = {
	pending: MigrationFile[];
	drifted: { name: string; recorded: string; actual: string }[];
	missing: string[];
};

/**
 * sha256 of the migration as written on disk, BEFORE `{{DB_NAME}}` substitution.
 *
 * Substituting first would give one migration a different checksum in every environment
 * whose database is named differently, and each of them would then read as drift.
 */
export function migrationChecksum(sql: string): string {
	return createHash("sha256").update(sql, "utf8").digest("hex");
}

/**
 * Decide what to apply, refuse, or complain about -- without touching a database.
 *
 * A file that drifted is never also pending: re-running an edited migration is exactly
 * what the checksum exists to prevent. Both drift and missing are computed over the whole
 * set so the caller can refuse before executing a single statement.
 */
export function planMigrations(files: MigrationFile[], applied: AppliedMigration[]): MigrationPlan {
	const recordedByName = new Map(applied.map((row) => [row.name, row.checksum]));
	const namesOnDisk = new Set(files.map((file) => file.name));

	const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name));

	const pending: MigrationFile[] = [];
	const drifted: MigrationPlan["drifted"] = [];

	for (const file of ordered) {
		const recorded = recordedByName.get(file.name);
		if (recorded === undefined) {
			pending.push(file);
			continue;
		}
		const actual = migrationChecksum(file.sql);
		if (recorded !== actual) {
			drifted.push({ name: file.name, recorded, actual });
		}
	}

	const missing = applied
		.map((row) => row.name)
		.filter((name) => !namesOnDisk.has(name))
		.sort();

	return { pending, drifted, missing };
}
