import { describe, expect, it } from "vitest";
import { PLACEHOLDER_KEY_PATTERN } from "@genum/placeholders";
import { PlaceholderCreateSchema } from "./placeholder.type";

// C4: placeholder.type.ts's comment claims the zod key regex "is pinned equal to
// @genum/placeholders' PLACEHOLDER_KEY_PATTERN by a test in
// packages/placeholders/src/detect.test.ts" -- that test only pins the package
// pattern's `.source` against a string literal and never touches the core schema,
// and the two live in different vitest projects. This is the test the comment
// claims: it derives the accepted character class directly from
// PLACEHOLDER_KEY_PATTERN and asserts the zod schema agrees with it exactly, so a
// widened zod regex (e.g. allowing `-`) fails here instead of creating a
// placeholder no substitution could ever reach.
describe("PlaceholderCreateSchema key regex stays in lockstep with PLACEHOLDER_KEY_PATTERN", () => {
	// PLACEHOLDER_KEY_PATTERN is "\{\{([a-zA-Z0-9_]+)\}\}" -- pull the captured
	// character class out rather than hard-coding it a second time.
	const captureGroup = PLACEHOLDER_KEY_PATTERN.source.match(/\(([^)]+)\)/)?.[1];
	if (!captureGroup) {
		throw new Error("PLACEHOLDER_KEY_PATTERN no longer has a capture group to pin against.");
	}
	const packageKeyPattern = new RegExp(`^${captureGroup}$`);

	function accepts(schema: typeof PlaceholderCreateSchema, key: string) {
		return schema.safeParse({ key }).success;
	}

	const acceptedByPattern = ["admin_role", "memory_key", "a", "A1_2b", "___", "123"];
	const rejectedByPattern = [
		"admin-role", // the exact case the finding calls out
		"admin role",
		"admin.role",
		"",
		"admin/role",
		"emoji😀",
	];

	it.each(acceptedByPattern)("accepts %s, exactly as PLACEHOLDER_KEY_PATTERN does", (key) => {
		expect(packageKeyPattern.test(key)).toBe(true);
		expect(accepts(PlaceholderCreateSchema, key)).toBe(true);
	});

	it.each(rejectedByPattern)("rejects %s, exactly as PLACEHOLDER_KEY_PATTERN does", (key) => {
		expect(packageKeyPattern.test(key)).toBe(false);
		expect(accepts(PlaceholderCreateSchema, key)).toBe(false);
	});
});
