import type { ClickHouseClient } from "@clickhouse/client";
import { describe, expect, it } from "vitest";
import { assertSafeDatabaseName, prepareMigration, readAppliedMigrations } from "./migrate";

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
