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
