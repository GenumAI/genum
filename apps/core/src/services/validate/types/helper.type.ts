import { ChatMode } from "@/ai/runner/types";
import { z } from "zod";

const CanvasChatMessageContextSchema = z
	.object({
		input: z.string().optional(),
		lastOutput: z.string().optional(),
		lastThoughts: z.string().optional(),
		expectedOutput: z.string().optional(),
		expectedThoughts: z.string().optional(),
	})
	.strict();
export type CanvasChatMessageContextType = z.infer<typeof CanvasChatMessageContextSchema>;
export const CanvasChatMessageSchema = z
	.object({
		query: z.string(),
		context: CanvasChatMessageContextSchema.optional(),
		mode: z.enum(ChatMode).default(ChatMode.AGENT),
	})
	.strict();

export type CanvasChatMessageType = z.infer<typeof CanvasChatMessageSchema>;

export const PromptEditSchema = z
	.object({
		query: z.string().min(1),
	})
	.strict();

export type PromptEditType = z.infer<typeof PromptEditSchema>;

export const ContentPrettifySchema = z
	.object({
		content: z.string().min(1),
	})
	.strict();
export type ContentPrettifyType = z.infer<typeof ContentPrettifySchema>;

export const PromptTuneSchema = z
	.object({
		instruction: z.string(),
		input: z.string().optional().default(""),
		output: z.string().optional().default(""),
		expectedOutput: z.string().optional().default(""),
		context: z.string().optional().default(""),
	})
	.strict();

export type PromptTuneType = z.infer<typeof PromptTuneSchema>;
