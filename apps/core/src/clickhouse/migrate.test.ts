import type { ClickHouseClient } from "@clickhouse/client";
import { describe, expect, it } from "vitest";
import {
	applyPending,
	assertSafeDatabaseName,
	prepareMigration,
	readAppliedMigrations,
} from "./migrate";
import type { MigrationFile } from "./plan";

const rawFile = {
	name: "001_a.sql",
	sql: "CREATE TABLE {{DB_NAME}}.logs (a UInt8) ENGINE = Memory",
};

describe("prepareMigration", () => {
	it("checksums the same regardless of which database it is prepared for", () => {
		const forFirst = prepareMigration(rawFile, "first_db");
		const forSecond = prepareMigration(rawFile, "second_db");
		expect(forFirst.checksum).toBe(forSecond.checksum);
	});

	it("produces different statements for different databases", () => {
		const forFirst = prepareMigration(rawFile, "first_db");
		const forSecond = prepareMigration(rawFile, "second_db");
		expect(forFirst.statements).not.toEqual(forSecond.statements);
	});

	it("substitutes {{DB_NAME}} with the real database name in the statements", () => {
		const { statements } = prepareMigration(rawFile, "real_db");
		expect(statements).toEqual(["CREATE TABLE real_db.logs (a UInt8) ENGINE = Memory"]);
	});

	it("splits the substituted sql into multiple statements", () => {
		const file = {
			name: "001_a.sql",
			sql: "SELECT 1 FROM {{DB_NAME}}.a; SELECT 2 FROM {{DB_NAME}}.b",
		};
		const { statements } = prepareMigration(file, "db");
		expect(statements).toEqual(["SELECT 1 FROM db.a", "SELECT 2 FROM db.b"]);
	});
});

describe("assertSafeDatabaseName", () => {
	it("accepts alphanumeric and underscore names", () => {
		expect(() => assertSafeDatabaseName("genum_lab_2")).not.toThrow();
	});

	it("rejects names with characters that could break out of DDL", () => {
		expect(() => assertSafeDatabaseName("genum; DROP TABLE x")).toThrow();
	});

	it("rejects an empty name", () => {
		expect(() => assertSafeDatabaseName("")).toThrow();
	});
});

/**
 * `buildPlan` reads `_migrations` without going through `ensureDatabase` or
 * `applyPending`, so the read path has to validate the name itself. The stub client
 * fails the test if it is reached: the point is that the name never becomes SQL.
 */
describe("readAppliedMigrations", () => {
	it("rejects an unsafe database name before issuing a query", async () => {
		const client = {
			query: () => {
				throw new Error("query() must not be reached for an unsafe name");
			},
		} as unknown as ClickHouseClient;

		await expect(
			readAppliedMigrations(client, "logs; DROP TABLE logs"),
		).rejects.toThrow(/Invalid ClickHouse database name/);
	});
});

/**
 * `applyPending` is the one function that can bring back the defect this whole change
 * exists to remove: a migration recorded as applied when its statements never ran. The
 * pure tests above cannot see that, and neither can the plan tests. A fake client can,
 * because the ORDER of the calls is the contract -- every statement, then the insert.
 */
describe("applyPending", () => {
	type Call = { kind: "command" | "insert"; payload: string };

	function fakeClient(failOn?: string) {
		const calls: Call[] = [];
		const client = {
			command: async ({ query }: { query: string }) => {
				calls.push({ kind: "command", payload: query });
				if (failOn && query.includes(failOn)) {
					throw new Error("Syntax error: failing on purpose");
				}
			},
			insert: async ({ values }: { values: { name: string }[] }) => {
				calls.push({ kind: "insert", payload: values[0].name });
			},
		} as unknown as ClickHouseClient;
		return { client, calls };
	}

	const fileA: MigrationFile = {
		name: "001_a.sql",
		sql: "CREATE TABLE {{DB_NAME}}.a (x UInt8) ENGINE = Memory",
	};
	const fileB: MigrationFile = {
		name: "002_b.sql",
		sql: "CREATE TABLE {{DB_NAME}}.b (x UInt8) ENGINE = Memory;\nCREATE TABLE {{DB_NAME}}.c (x UInt8) ENGINE = Memory",
	};
	const emptyPlan = { pending: [], drifted: [], missing: [] };

	it("records a migration only after every one of its statements has run", async () => {
		const { client, calls } = fakeClient();

		const applied = await applyPending(client, "probe", { ...emptyPlan, pending: [fileB] });

		expect(applied).toEqual(["002_b.sql"]);
		// Two statements, THEN the bookkeeping row. Hoisting the insert above the loop --
		// the edit that would make a failed migration look applied -- reorders this.
		expect(calls.map((c) => c.kind)).toEqual(["command", "command", "insert"]);
		expect(calls[2].payload).toBe("002_b.sql");
	});

	it("records the raw-file checksum, not one taken after substitution", async () => {
		const checksums: string[] = [];
		const client = {
			command: async () => {},
			insert: async ({ values }: { values: { checksum: string }[] }) => {
				checksums.push(values[0].checksum);
			},
		} as unknown as ClickHouseClient;

		await applyPending(client, "one_name", { ...emptyPlan, pending: [fileA] });
		await applyPending(client, "another_name", { ...emptyPlan, pending: [fileA] });

		expect(checksums[0]).toBe(checksums[1]);
	});

	it("does not record a migration whose statement failed, and stops there", async () => {
		const { client, calls } = fakeClient(".c ");

		await expect(
			applyPending(client, "probe", { ...emptyPlan, pending: [fileA, fileB] }),
		).rejects.toThrow(/002_b\.sql failed at statement 2 of 2/);

		// 001 ran and was recorded; 002 ran its first statement, failed on the second,
		// and left no row -- so the next run retries it.
		expect(calls.filter((c) => c.kind === "insert").map((c) => c.payload)).toEqual([
			"001_a.sql",
		]);
	});

	it("refuses to execute anything when the plan reports drift", async () => {
		const { client, calls } = fakeClient();

		await expect(
			applyPending(client, "probe", {
				pending: [fileA],
				drifted: [{ name: "001_a.sql", recorded: "aaa", actual: "bbb" }],
				missing: [],
			}),
		).rejects.toThrow(/recorded history and the files on disk disagree/);

		expect(calls).toEqual([]);
	});
});
