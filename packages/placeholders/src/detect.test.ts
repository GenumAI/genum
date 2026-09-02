import { describe, expect, it } from "vitest";
import { detectPlaceholderKeys, PLACEHOLDER_KEY_PATTERN, renamePlaceholderKey } from "./detect";

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

describe("renamePlaceholderKey", () => {
	it("rewrites every occurrence of the key", () => {
		const result = renamePlaceholderKey("a {{role}} b {{role}} c", "role", "admin_role");
		expect(result.text).toBe("a {{admin_role}} b {{admin_role}} c");
		expect(result.occurrences).toBe(2);
	});

	it("leaves other keys alone", () => {
		const result = renamePlaceholderKey("{{role}} {{tone}}", "role", "admin_role");
		expect(result.text).toBe("{{admin_role}} {{tone}}");
		expect(result.occurrences).toBe(1);
	});

	// The normal case right after a placeholder is created and not yet written into the
	// prompt: the caller uses `occurrences` to decide whether to write the prompt at all.
	it("reports zero occurrences when the key is not in the text", () => {
		const result = renamePlaceholderKey("nothing here", "role", "admin_role");
		expect(result.text).toBe("nothing here");
		expect(result.occurrences).toBe(0);
	});

	// Substring safety: renaming `role` must not touch `admin_role`, which a naive
	// replace of the bare word would corrupt into "admin_admin_role".
	it("does not match a key that merely contains the old key", () => {
		const result = renamePlaceholderKey("{{admin_role}}", "role", "user_role");
		expect(result.text).toBe("{{admin_role}}");
		expect(result.occurrences).toBe(0);
	});

	it("is a no-op when the name did not change", () => {
		const result = renamePlaceholderKey("{{role}}", "role", "role");
		expect(result.text).toBe("{{role}}");
		expect(result.occurrences).toBe(0);
	});
});
