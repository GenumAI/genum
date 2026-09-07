import { describe, it, expect } from "vitest";
import { normalize } from "./normalize";

// Pins the shipped STRICT-assertion behaviour byte for byte. `normalize` moved here out
// of testcase.controller.ts so `ai/steps/compare.ts` can reuse it; nothing about what it
// returns may change, because every existing STRICT text testcase depends on it.
describe("normalize", () => {
	it("trims and lowercases a non-JSON answer", () => {
		expect(normalize("  It Is 12°  ")).toBe("it is 12°");
	});

	it("sorts object keys of a JSON answer", () => {
		expect(normalize('{"b":2,"a":1}')).toBe('{"a":1,"b":2}');
	});

	it("sorts keys of nested objects and keeps array order", () => {
		expect(normalize('{"z":[{"b":1,"a":2}],"a":1}')).toBe('{"a":1,"z":[{"a":2,"b":1}]}');
	});

	it("drops chainOfThoughts at every level", () => {
		expect(normalize('{"a":1,"chainOfThoughts":"why"}')).toBe('{"a":1}');
		expect(normalize('{"x":{"chainOfThoughts":"why","b":2}}')).toBe('{"x":{"b":2}}');
	});

	it("treats a bare number or boolean as JSON", () => {
		expect(normalize("12")).toBe("12");
		expect(normalize("true")).toBe("true");
	});

	it("stringifies a non-string input before comparing", () => {
		expect(normalize(undefined)).toBe("undefined");
		expect(normalize(null)).toBe("null");
	});
});
