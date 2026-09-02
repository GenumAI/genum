import { describe, expect, it } from "vitest";
import { migrationChecksum, planMigrations } from "./plan";

const file = (name: string, sql: string) => ({ name, sql });

describe("migrationChecksum", () => {
	it("is stable for the same content", () => {
		expect(migrationChecksum("SELECT 1")).toBe(migrationChecksum("SELECT 1"));
	});

	it("differs when the content differs", () => {
		expect(migrationChecksum("SELECT 1")).not.toBe(migrationChecksum("SELECT 2"));
	});

	// The invariant this scheme rests on -- one migration keeps ONE checksum across
	// environments whose database names differ -- cannot be pinned here: `planMigrations`
	// never substitutes. It is pinned where the choice is actually made, in
	// `prepareMigration`; see migrate.test.ts.
});

describe("planMigrations", () => {
	it("reports every file as pending against an empty database", () => {
		const plan = planMigrations([file("002_b.sql", "B"), file("001_a.sql", "A")], []);
		expect(plan.pending.map((f) => f.name)).toEqual(["001_a.sql", "002_b.sql"]);
		expect(plan.drifted).toEqual([]);
		expect(plan.missing).toEqual([]);
	});

	it("orders pending by filename, not by the order they were read", () => {
		const plan = planMigrations(
			[file("20260903_c.sql", "C"), file("20260901_a.sql", "A"), file("20260902_b.sql", "B")],
			[],
		);
		expect(plan.pending.map((f) => f.name)).toEqual([
			"20260901_a.sql",
			"20260902_b.sql",
			"20260903_c.sql",
		]);
	});

	it("leaves an already applied migration out of pending", () => {
		const applied = [{ name: "001_a.sql", checksum: migrationChecksum("A") }];
		const plan = planMigrations([file("001_a.sql", "A"), file("002_b.sql", "B")], applied);
		expect(plan.pending.map((f) => f.name)).toEqual(["002_b.sql"]);
		expect(plan.drifted).toEqual([]);
	});

	it("reports an edited applied migration as drift, and never as pending", () => {
		const applied = [{ name: "001_a.sql", checksum: migrationChecksum("A") }];
		const plan = planMigrations([file("001_a.sql", "A EDITED")], applied);
		expect(plan.pending).toEqual([]);
		expect(plan.drifted).toEqual([
			{
				name: "001_a.sql",
				recorded: migrationChecksum("A"),
				actual: migrationChecksum("A EDITED"),
			},
		]);
	});

	it("reports an applied migration whose file is gone as missing", () => {
		const applied = [
			{ name: "001_a.sql", checksum: migrationChecksum("A") },
			{ name: "000_gone.sql", checksum: "whatever" },
		];
		const plan = planMigrations([file("001_a.sql", "A")], applied);
		expect(plan.missing).toEqual(["000_gone.sql"]);
	});
});
