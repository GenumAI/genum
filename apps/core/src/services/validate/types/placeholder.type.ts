import { z } from "zod";

// The key is what the author types inside {{ }}, so it must be exactly what the
// renderer can find. Anything else creates a placeholder no substitution can reach.
// This literal is pinned equal to @genum/placeholders' PLACEHOLDER_KEY_PATTERN by a
// test in this file's own placeholder.type.test.ts, which imports the pattern and
// asserts this schema against it directly — keep them in lockstep.
export const placeholderKey = z
	.string()
	.trim()
	.min(1)
	.max(64)
	.regex(/^[a-zA-Z0-9_]+$/, {
		message: "A placeholder key may contain only letters, digits and underscores.",
	});

export const PlaceholderCreateSchema = z
	.object({
		key: placeholderKey,
		description: z.string().max(500).nullish(),
	})
	.strict();

export type PlaceholderCreateType = z.infer<typeof PlaceholderCreateSchema>;

export const PlaceholderUpdateSchema = PlaceholderCreateSchema.partial().strict();
export type PlaceholderUpdateType = z.infer<typeof PlaceholderUpdateSchema>;

export const PlaceholderValueCreateSchema = z
	.object({
		name: z.string().trim().min(1).max(255),
		content: z.string(),
		isDefault: z.boolean().optional().default(false),
	})
	.strict();

export type PlaceholderValueCreateType = z.infer<typeof PlaceholderValueCreateSchema>;

export const PlaceholderValueUpdateSchema = z
	.object({
		name: z.string().trim().min(1).max(255),
		content: z.string(),
		isDefault: z.boolean(),
	})
	.partial()
	.strict();

export type PlaceholderValueUpdateType = z.infer<typeof PlaceholderValueUpdateSchema>;

/**
 * One placeholder, with its values, as a prompt-creation payload carries it.
 *
 * The interactive routes build a placeholder over several requests -- create the key,
 * then add values one at a time -- and each request can be validated on its own. A
 * prompt created through the API arrives whole, so the constraints those routes get from
 * the database across several calls have to hold within a single payload here.
 *
 * Two are checked in this schema rather than left to the unique indexes: duplicate value
 * names, and more than one default. Both would otherwise surface as a Prisma constraint
 * violation naming an index, from a write that has already half-happened -- and the
 * "at most one default" index is partial, so the second default does not always collide
 * with the first. Rejecting the payload says which key is wrong, before anything is
 * written.
 */
export const PromptPlaceholderCreateSchema = z
	.object({
		key: placeholderKey,
		description: z.string().max(500).nullish(),
		// A placeholder with no values renders as an empty string wherever it appears --
		// a hole the author cannot fill and cannot see, since the key vanishes from the
		// rendered text. Creating one is never what the caller meant.
		values: z.array(PlaceholderValueCreateSchema).min(1).max(100),
	})
	.strict()
	.refine(
		(placeholder) =>
			new Set(placeholder.values.map((value) => value.name)).size ===
			placeholder.values.length,
		{ message: "Value names must be unique within a placeholder.", path: ["values"] },
	)
	.refine((placeholder) => placeholder.values.filter((value) => value.isDefault).length <= 1, {
		message: "A placeholder may have at most one default value.",
		path: ["values"],
	});

export type PromptPlaceholderCreateType = z.infer<typeof PromptPlaceholderCreateSchema>;

/** The `placeholders` array of a prompt-creation payload: keys unique across it. */
export const PromptPlaceholdersCreateSchema = z
	.array(PromptPlaceholderCreateSchema)
	.max(100)
	.refine(
		(placeholders) =>
			new Set(placeholders.map((placeholder) => placeholder.key)).size ===
			placeholders.length,
		{ message: "Placeholder keys must be unique within a prompt." },
	);
