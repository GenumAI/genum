import { describe, expect, it } from "vitest";
import { detectPlaceholderKeys, PLACEHOLDER_KEY_PATTERN } from "./detect";

describe("detectPlaceholderKeys", () => {
	it("finds every key in order of first appearance", () => {
		expect(detectPlaceholderKeys("a {{one}} b {{two}} c")).toEqual(["one", "two"]);
	});

	it("de-duplicates a key used more than once", () => {
		expect(detectPlaceholderKeys("{{k}} and again {{k}}")).toEqual(["k"]);
	});

	it("returns an empty array when there is nothing to find", () => {
		expect(detectPlaceholderKeys("plain text")).toEqual([]);
	});

	it("ignores malformed markers", () => {
		// Single braces, spaces inside, and characters outside [a-zA-Z0-9_] are not keys.
		expect(detectPlaceholderKeys("{one} {{ two }} {{th-ree}} {{}}")).toEqual([]);
	});

	it("pins the key character class a validator will duplicate", () => {
		expect(PLACEHOLDER_KEY_PATTERN.source).toBe("\\{\\{([a-zA-Z0-9_]+)\\}\\}");
	});
});
