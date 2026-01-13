import { AssertionTypeSchema, PromptSchema as PromptSchemaGenerated } from "@/prisma-types";
import { LogLevel, SourceType } from "@/services/logger/types";
import { z } from "zod";

const PromptSchema = PromptSchemaGenerated.extend({
	name: z.string().trim().min(1).max(128),
});

export const PromptCreateSchema = PromptSchema.pick({
	name: true,
	value: true,
}).strict();

export type PromptCreateType = z.infer<typeof PromptCreateSchema>;

export const PromptUpdateSchema = PromptSchema.pick({
	name: true,
	value: true,
	assertionType: true,
	assertionValue: true,
})
	.extend({
		assertionType: AssertionTypeSchema.optional(),
	})
	.partial()
	.strict();

export type PromptUpdateType = z.infer<typeof PromptUpdateSchema>;

export const PromptUpdateLLMConfigSchema = z
	.object({
		languageModelId: z.number(),
		languageModelConfig: z.any(),
	})
	.partial()
	.strict();

export type PromptUpdateLLMConfigType = z.infer<typeof PromptUpdateLLMConfigSchema>;

export const PromptRunSchema = z
	.object({
		question: z.string(),
		memoryId: z.number().optional(),
	})
	.strict();

export type PromptRunType = z.infer<typeof PromptRunSchema>;

export const PromptCommitSchema = z
	.object({
		commitMessage: z.string().min(1).max(512),
	})
	.strict();

export type PromptCommitType = z.infer<typeof PromptCommitSchema>;

export const PromptLogsQuerySchema = z
	.object({
		page: z.coerce.number().int().positive().default(1).optional(),
		pageSize: z.coerce.number().int().min(1).max(100).default(10).optional(),
		fromDate: z.coerce.date().optional(),
		toDate: z.coerce.date().optional(),
		source: z.nativeEnum(SourceType).optional(),
		logLevel: z.nativeEnum(LogLevel).optional(),
		query: z.string().optional(),
	})
	.strict();

export type PromptLogsQueryType = z.infer<typeof PromptLogsQuerySchema>;

export const AssertionEditorSchema = z
	.object({
		query: z.string().optional(),
	})
	.strict();
export type AssertionEditorType = z.infer<typeof AssertionEditorSchema>;

export const JsonSchemaEditorSchema = z
	.object({
		query: z.string().min(1),
		jsonSchema: z.string().min(1).optional(),
	})
	.strict();
export type JsonSchemaEditorType = z.infer<typeof JsonSchemaEditorSchema>;

export const ToolEditorSchema = z
	.object({
		query: z.string().min(1),
		tool: z.string().min(1).optional(),
	})
	.strict();
export type ToolEditorType = z.infer<typeof ToolEditorSchema>;

export const InputGeneratorSchema = z
	.object({
		query: z.string().optional(),
		systemPrompt: z.string().min(1),
	})
	.strict();
export type InputGeneratorType = z.infer<typeof InputGeneratorSchema>;
