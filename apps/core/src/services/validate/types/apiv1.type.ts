import { z } from "zod";

export const ApiRunPromptFileSchema = z
	.object({
		fileName: z.string().min(1).max(255),
		contentType: z.string().min(1).max(255),
		base64: z.string().min(1),
	})
	.strict();

export const RunPromptSchema = z
	.object({
		id: z.coerce.number().int().positive(),
		question: z.string(),
		placeholders: z.record(z.string(), z.string()).optional(),
		/** @deprecated use `placeholders: { memory_key: "..." }` */
		memoryKey: z.string().optional(),
		files: z.array(ApiRunPromptFileSchema).max(3).optional().default([]),
		createTicket: z.coerce.boolean().optional().default(false), // todo remove this
		productive: z.coerce.boolean().optional().default(true),
	})
	.strict();

export type RunPromptType = z.infer<typeof RunPromptSchema>;

export const GetPromptQuerySchema = z
	.object({
		// custom rules. zod doesn't support boolean in query params
		productive: z
			.union([
				z.literal("true").transform(() => true),
				z.literal("false").transform(() => false),
				z.literal("1").transform(() => true),
				z.literal("0").transform(() => false),
				z.boolean(),
			])
			.optional()
			.default(true),
	})
	.strict();

export type GetPromptQueryType = z.infer<typeof GetPromptQuerySchema>;

/**
 * `POST /prompts/:id/render` -- the same body a run takes, minus the run.
 *
 * `productive` defaults to true for the same reason it does on a run: an external caller
 * wants the committed prompt, and getting the editor's uncommitted draft by default would
 * ship someone's half-finished edit to production traffic.
 */
export const RenderPromptSchema = z
	.object({
		placeholders: z.record(z.string(), z.string()).optional(),
		productive: z.coerce.boolean().optional().default(true),
	})
	.strict();

export type RenderPromptType = z.infer<typeof RenderPromptSchema>;
