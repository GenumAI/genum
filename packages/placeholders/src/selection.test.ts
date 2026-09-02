import { describe, expect, it } from "vitest";
import { filterValidPlaceholderSelections } from "./selection";
import type { PlaceholderDefinition } from "./types";

const ADMIN_ROLE: PlaceholderDefinition = {
	key: "admin_role",
	values: [
		{ name: "on", content: "act as admin", isDefault: false },
		{ name: "off", content: "", isDefault: true },
	],
};

const TONE: PlaceholderDefinition = {
	key: "tone",
	values: [{ name: "formal", content: "be formal", isDefault: false }],
};

describe("filterValidPlaceholderSelections", () => {
	it("keeps a selection whose value name exists on the definition", () => {
		const result = filterValidPlaceholderSelections({ admin_role: "on" }, [ADMIN_ROLE]);
		expect(result).toEqual({ admin_role: "on" });
	});

	it("drops a selection naming a value that does not exist on the definition", () => {
		const result = filterValidPlaceholderSelections({ admin_role: "typo" }, [ADMIN_ROLE]);
		expect(result).toEqual({});
	});

	it("drops a selection for a key with no definition at all (e.g. from another prompt)", () => {
		const result = filterValidPlaceholderSelections({ from_other_prompt: "x" }, [ADMIN_ROLE]);
		expect(result).toEqual({});
	});

	it("filters a mix of valid, stale-value, and foreign-key selections independently", () => {
		const result = filterValidPlaceholderSelections(
			{ admin_role: "on", tone: "typo", ghost_key: "x" },
			[ADMIN_ROLE, TONE],
		);
		expect(result).toEqual({ admin_role: "on" });
	});

	it("returns an empty object for an empty selection against known definitions", () => {
		expect(filterValidPlaceholderSelections({}, [ADMIN_ROLE])).toEqual({});
	});

	// The case from the whole-branch review's item 1: an unsettled (loading/errored)
	// definitions state must not be treated as "known to be empty". Passing `null`
	// signals "not yet known" and must return the selection UNCHANGED, not filtered
	// down to nothing.
	it("passes the selection through unfiltered when definitions are null (unknown, not empty)", () => {
		const selection = { admin_role: "on", tone: "formal" };
		const result = filterValidPlaceholderSelections(selection, null);
		expect(result).toEqual(selection);
	});

	it("does not mutate or alias the original selection object when definitions are null", () => {
		const selection = { admin_role: "on" };
		const result = filterValidPlaceholderSelections(selection, null);
		expect(result).not.toBe(selection);
		expect(result).toEqual(selection);
	});

	it("treats null definitions as unknown even for an empty selection", () => {
		expect(filterValidPlaceholderSelections({}, null)).toEqual({});
	});

	it("an empty (but known) definitions array is NOT the same as null -- everything is filtered out", () => {
		const result = filterValidPlaceholderSelections({ admin_role: "on" }, []);
		expect(result).toEqual({});
	});
});
