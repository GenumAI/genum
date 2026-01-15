import { z } from "zod";

export const modelSettingsSchema = z.object({
	selectedModel: z.string().min(1, "Please select a model"),
	selectedModelId: z.number().nullable(),
	maxTokens: z.number().nullable(),
	temperature: z.number().nullable(),
	topP: z.number().nullable(),
	frequencyPenalty: z.number().nullable(),
	presencePenalty: z.number().nullable(),
	responseFormat: z.string(),
	verbosity: z.enum(["low", "medium", "high"]).nullable().optional(),
	reasoningEffort: z
		.enum(["none", "minimal", "low", "medium", "high", "xhigh"])
		.nullable()
		.optional(),
});
