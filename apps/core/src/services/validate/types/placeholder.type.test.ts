import { describe, expect, it } from "vitest";
import { PLACEHOLDER_KEY_PATTERN } from "@genum/placeholders";
import { PlaceholderCreateSchema, PromptPlaceholdersCreateSchema } from "./placeholder.type";

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

describe("PromptPlaceholdersCreateSchema", () => {
	const value = (over: Partial<{ name: string; content: string; isDefault: boolean }> = {}) => ({
		name: "workspace_admin",
		content: "May administer the workspace.",
		...over,
	});

	it("accepts a placeholder with values", () => {
		const parsed = PromptPlaceholdersCreateSchema.safeParse([
			{ key: "admin_rules", description: "Role rules", values: [value()] },
		]);

		expect(parsed.success).toBe(true);
	});

	it("rejects a placeholder with no values", () => {
		// It would render as an empty string everywhere it appears -- a hole the author
		// can neither fill nor see, since the key vanishes from the rendered text.
		const parsed = PromptPlaceholdersCreateSchema.safeParse([
			{ key: "admin_rules", values: [] },
		]);

		expect(parsed.success).toBe(false);
	});

	it("rejects two values with the same name inside one placeholder", () => {
		// The unique index would catch it, but only after part of the payload is written,
		// and the error would name an index rather than the key at fault.
		const parsed = PromptPlaceholdersCreateSchema.safeParse([
			{ key: "admin_rules", values: [value(), value({ content: "other" })] },
		]);

		expect(parsed.success).toBe(false);
	});

	it("rejects two defaults inside one placeholder", () => {
		// The "one default" index is PARTIAL, so a second default does not reliably
		// collide with the first -- the database would accept an ambiguous placeholder.
		const parsed = PromptPlaceholdersCreateSchema.safeParse([
			{
				key: "admin_rules",
				values: [
					value({ isDefault: true }),
					value({ name: "none", isDefault: true }),
				],
			},
		]);

		expect(parsed.success).toBe(false);
	});

	it("accepts one default", () => {
		const parsed = PromptPlaceholdersCreateSchema.safeParse([
			{
				key: "admin_rules",
				values: [value({ isDefault: true }), value({ name: "none" })],
			},
		]);

		expect(parsed.success).toBe(true);
	});

	it("rejects the same key twice in one prompt", () => {
		const parsed = PromptPlaceholdersCreateSchema.safeParse([
			{ key: "admin_rules", values: [value()] },
			{ key: "admin_rules", values: [value({ name: "none" })] },
		]);

		expect(parsed.success).toBe(false);
	});

	it("rejects a key the renderer could never find", () => {
		const parsed = PromptPlaceholdersCreateSchema.safeParse([
			{ key: "admin-rules", values: [value()] },
		]);

		expect(parsed.success).toBe(false);
	});

	it("rejects an unknown field rather than dropping it", () => {
		const parsed = PromptPlaceholdersCreateSchema.safeParse([
			{ key: "admin_rules", values: [value()], colour: "red" },
		]);

		expect(parsed.success).toBe(false);
	});
});
