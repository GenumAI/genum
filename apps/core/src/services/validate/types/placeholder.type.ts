import { z } from "zod";

// The key is what the author types inside {{ }}, so it must be exactly what the
// renderer can find. Anything else creates a placeholder no substitution can reach.
// This literal is pinned equal to @genum/placeholders' PLACEHOLDER_KEY_PATTERN by a
// test in this file's own placeholder.type.test.ts, which imports the pattern and
// asserts this schema against it directly — keep them in lockstep.
const placeholderKey = z
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
