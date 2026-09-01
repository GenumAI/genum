import { describe, expect, it } from "vitest";
import { parsePlaceholderSnapshot, toPlaceholderDefinitions } from "./definitions";

describe("toPlaceholderDefinitions", () => {
	it("keeps only what the renderer needs", () => {
		const rows = [
			{
				id: 1,
				key: "admin_role",
				description: "author note",
				promptId: 3,
				values: [
					{ id: 10, name: "false", content: "", isDefault: true, placeholderId: 1 },
					{ id: 11, name: "true", content: "block", isDefault: false, placeholderId: 1 },
				],
			},
		];

		expect(toPlaceholderDefinitions(rows as never)).toEqual([
			{
				key: "admin_role",
				values: [
					{ name: "false", content: "", isDefault: true },
					{ name: "true", content: "block", isDefault: false },
				],
			},
		]);
	});
});

describe("parsePlaceholderSnapshot", () => {
	it("reads a committed snapshot", () => {
		const snapshot = [
			{ key: "k", values: [{ name: "v", content: "c", isDefault: true }] },
		];

		expect(parsePlaceholderSnapshot(snapshot)).toEqual(snapshot);
	});

	it("treats a version committed before this feature as having no definitions", () => {
		expect(parsePlaceholderSnapshot(null)).toEqual([]);
		expect(parsePlaceholderSnapshot(undefined)).toEqual([]);
	});

	it("refuses malformed JSON rather than crashing a run", () => {
		expect(parsePlaceholderSnapshot({ nope: true })).toEqual([]);
		expect(parsePlaceholderSnapshot([{ key: 1 }])).toEqual([]);
	});

	it("refuses a non-array values field", () => {
		expect(parsePlaceholderSnapshot([{ key: "k", values: "not-an-array" }])).toEqual([]);
	});

	it("refuses a non-object entry inside values", () => {
		expect(parsePlaceholderSnapshot([{ key: "k", values: ["not-an-object"] }])).toEqual([]);
	});

	it("refuses a value entry with a non-string name", () => {
		expect(
			parsePlaceholderSnapshot([
				{ key: "k", values: [{ name: 1, content: "c", isDefault: true }] },
			]),
		).toEqual([]);
	});

	it("refuses a value entry with a non-string content", () => {
		expect(
			parsePlaceholderSnapshot([
				{ key: "k", values: [{ name: "v", content: 1, isDefault: true }] },
			]),
		).toEqual([]);
	});

	it("refuses a value entry with a non-boolean isDefault", () => {
		expect(
			parsePlaceholderSnapshot([
				{ key: "k", values: [{ name: "v", content: "c", isDefault: "true" }] },
			]),
		).toEqual([]);
	});
});
