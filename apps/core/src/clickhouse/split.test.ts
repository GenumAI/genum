import { describe, expect, it } from "vitest";
import { splitStatements } from "./split";

describe("splitStatements", () => {
	it("splits on semicolons between statements", () => {
		expect(splitStatements("SELECT 1; SELECT 2;")).toEqual(["SELECT 1", "SELECT 2"]);
	});

	it("keeps a semicolon that lives inside a string literal", () => {
		expect(splitStatements("INSERT INTO t VALUES ('a;b'); SELECT 1")).toEqual([
			"INSERT INTO t VALUES ('a;b')",
			"SELECT 1",
		]);
	});

	it("keeps a double dash that lives inside a string literal", () => {
		expect(splitStatements("SELECT 'a--b'")).toEqual(["SELECT 'a--b'"]);
	});

	it("strips line comments", () => {
		expect(splitStatements("-- a comment\nSELECT 1")).toEqual(["SELECT 1"]);
	});

	it("strips block comments", () => {
		expect(splitStatements("/* a\n comment */ SELECT 1")).toEqual(["SELECT 1"]);
	});

	it("handles a backslash-escaped quote inside a literal", () => {
		expect(splitStatements("SELECT 'it\\'s; fine'")).toEqual(["SELECT 'it\\'s; fine'"]);
	});

	it("keeps a semicolon inside a backtick-quoted identifier", () => {
		expect(splitStatements("SELECT `odd;name` FROM t")).toEqual(["SELECT `odd;name` FROM t"]);
	});

	it("keeps a semicolon inside a double-quoted identifier", () => {
		expect(splitStatements('SELECT "odd;name" FROM t')).toEqual(['SELECT "odd;name" FROM t']);
	});

	it("keeps a double quote that lives inside a single-quoted literal", () => {
		expect(splitStatements("SELECT 'say \"hi\"; now'")).toEqual(["SELECT 'say \"hi\"; now'"]);
	});

	it("ignores a trailing semicolon and trailing whitespace", () => {
		expect(splitStatements("SELECT 1;\n\n")).toEqual(["SELECT 1"]);
	});

	it("returns nothing for input that is only comments", () => {
		expect(splitStatements("-- nothing here\n/* nor here */\n")).toEqual([]);
	});

	it("returns nothing for empty input", () => {
		expect(splitStatements("")).toEqual([]);
	});
});
