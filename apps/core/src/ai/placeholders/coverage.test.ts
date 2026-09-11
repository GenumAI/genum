import { describe, expect, it } from "vitest";

import { placeholderCoverage } from "./coverage";

describe("placeholderCoverage", () => {
	it("reports a hole nothing defines", () => {
		// It renders as the literal `{{role}}` inside the instruction the model reads,
		// which is invisible to the caller and nonsense to the model.
		expect(placeholderCoverage("You are {{role}}.", [])).toEqual({
			undefinedKeys: ["role"],
			ignored: [],
		});
	});

	it("reports a definition the text never uses", () => {
		expect(placeholderCoverage("You are helpful.", [{ key: "role" }])).toEqual({
			undefinedKeys: [],
			ignored: ["role"],
		});
	});

	it("reports nothing when the two line up", () => {
		expect(placeholderCoverage("You are {{role}}.", [{ key: "role" }])).toEqual({
			undefinedKeys: [],
			ignored: [],
		});
	});

	it("reports both halves of a mismatch at once", () => {
		expect(placeholderCoverage("You are {{role}}.", [{ key: "rols" }])).toEqual({
			undefinedKeys: ["role"],
			ignored: ["rols"],
		});
	});

	it("names a repeated hole once", () => {
		expect(placeholderCoverage("{{role}} and {{role}}", [])).toEqual({
			undefinedKeys: ["role"],
			ignored: [],
		});
	});

	it("names a duplicated definition once", () => {
		// Validation rejects duplicate keys before this runs, but reporting the same
		// unused definition twice would be a defect if that ever stopped holding.
		expect(placeholderCoverage("hello", [{ key: "role" }, { key: "role" }])).toEqual({
			undefinedKeys: [],
			ignored: ["role"],
		});
	});

	it("ignores text that only looks like a placeholder", () => {
		// `{{a-b}}` is not the syntax the renderer substitutes, so calling it an
		// undefined key would ask the caller to define something unreachable.
		expect(placeholderCoverage("{{a-b}} {single} {{}}", [])).toEqual({
			undefinedKeys: [],
			ignored: [],
		});
	});
});
