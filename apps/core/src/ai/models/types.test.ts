import { describe, expect, it } from "vitest";

import { FunctionCallSchema, MAX_TOOL_PARAMETERS_BYTES } from "./types";

/**
 * The point of these is what SURVIVES. The shape this schema replaced was a plain
 * `z.object`, and zod strips unknown keys silently -- so every keyword the shape did not
 * name was dropped on the way into the database, and the schema an author typed and the
 * one we sent to the provider were different documents.
 */
describe("FunctionCallSchema parameters", () => {
	function parse(parameters: unknown) {
		const result = FunctionCallSchema.safeParse({ name: "get_weather", parameters });
		if (!result.success) return null;
		return result.data.parameters;
	}

	it("keeps an array property's items", () => {
		// The headline case: without `items` an array parameter is invalid for several
		// providers, and the author cannot see that anything was removed.
		expect(
			parse({
				type: "object",
				properties: { tags: { type: "array", items: { type: "string" } } },
			}),
		).toEqual({
			type: "object",
			properties: { tags: { type: "array", items: { type: "string" } } },
		});
	});

	it("keeps constraint keywords", () => {
		expect(
			parse({
				type: "object",
				properties: {
					when: { type: "string", format: "date-time", pattern: "^2" },
					count: { type: "integer", minimum: 1, maximum: 10 },
					tags: { type: "array", maxItems: 3 },
				},
			}),
		).toEqual({
			type: "object",
			properties: {
				when: { type: "string", format: "date-time", pattern: "^2" },
				count: { type: "integer", minimum: 1, maximum: 10 },
				tags: { type: "array", maxItems: 3 },
			},
		});
	});

	it("keeps a deeply nested schema whole", () => {
		const parameters = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						contacts: {
							type: "array",
							items: {
								type: "object",
								properties: { email: { type: "string", format: "email" } },
								required: ["email"],
							},
						},
					},
				},
			},
		};

		expect(parse(parameters)).toEqual(parameters);
	});

	it("keeps keywords the schema does not name at all", () => {
		expect(
			parse({
				type: "object",
				properties: { a: { type: "string" } },
				$defs: { x: { type: "string" } },
				anyOf: [{ required: ["a"] }],
			}),
		).toEqual({
			type: "object",
			properties: { a: { type: "string" } },
			$defs: { x: { type: "string" } },
			anyOf: [{ required: ["a"] }],
		});
	});

	it("accepts the root spelled in upper case, and stores it as sent", () => {
		// Normalising would rewrite the caller's document, which is exactly the habit
		// this schema exists to break.
		expect(parse({ type: "OBJECT" })).toEqual({ type: "OBJECT" });
	});

	it("rejects a root that is not an object", () => {
		// Every provider requires an object at a tool's root; an array root would be
		// refused by the API, later, inside a paid run.
		expect(parse({ type: "array", items: { type: "string" } })).toBeNull();
	});

	it("rejects parameters larger than the cap", () => {
		// This JSON is copied into every prompt version and every replayed testcase, so
		// an unbounded one is unbounded many times over.
		const huge = {
			type: "object",
			properties: { a: { type: "string", description: "x".repeat(MAX_TOOL_PARAMETERS_BYTES) } },
		};

		expect(parse(huge)).toBeNull();
	});

	it("accepts parameters just under the cap", () => {
		const description = "x".repeat(MAX_TOOL_PARAMETERS_BYTES - 100);
		expect(parse({ type: "object", properties: { a: { type: "string", description } } })).not.toBeNull();
	});
});
