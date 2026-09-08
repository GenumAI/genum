import { AssertionTypeSchema, PromptSchema as PromptSchemaGenerated } from "@/prisma-types";
import { LogLevel, SourceType } from "@/services/logger";
import { FunctionCallSchema } from "@/ai/models/types";
import type { ConversationMessage } from "@/ai/providers";
import { z } from "zod";

const PromptSchema = PromptSchemaGenerated.extend({
	name: z.string().trim().min(1).max(128),
});

// Shape mirrors ModelConfigParameters (src/ai/models/types.ts). Intentionally
// permissive (not `.strict()`): the modelConfigService sanitizer discards
// anything it doesn't recognize, so rejecting unknown keys here would just
// duplicate that work with a worse error message.
export const LanguageModelConfigSchema = z
	.object({
		temperature: z.number().optional(),
		response_format: z.enum(["text", "json_object", "json_schema"]).optional(),
		tools: z.array(FunctionCallSchema).optional(),
		max_tokens: z.number().optional(),
		json_schema: z.string().optional(),
		reasoning_effort: z
			.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"])
			.optional(),
		verbosity: z.enum(["low", "medium", "high"]).optional(),
	})
	.partial();

export type LanguageModelConfigInput = z.infer<typeof LanguageModelConfigSchema>;

export const PromptCreateSchema = PromptSchema.pick({
	name: true,
	value: true,
})
	.extend({
		languageModelName: z.string().min(1).optional(),
		languageModelConfig: LanguageModelConfigSchema.optional(),
	})
	.strict();

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

// Mirrors `ToolCall` / `ConversationMessage` in @/ai/providers. Boundary validation for
// the conversation the playground accumulates while the author supplies tool results --
// a tool is never executed by Genum, so this is the only place those results enter the
// system, and arbitrary JSON here would reach the provider call unchecked.
// Every turn of a trajectory is a billed provider call carrying the whole conversation
// so far, so the conversation is capped here rather than left to grow without bound.
const MAX_CONVERSATION_MESSAGES = 100;
const MAX_MESSAGE_CONTENT = 32_000;

const ToolCallSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		args: z.record(z.string(), z.unknown()),
	})
	.strict();

const ConversationMessageSchema = z.discriminatedUnion("role", [
	z
		.object({
			role: z.literal("assistant"),
			content: z.string().max(MAX_MESSAGE_CONTENT),
			toolCalls: z.array(ToolCallSchema).optional(),
		})
		.strict(),
	z
		.object({
			role: z.literal("tool"),
			toolCallId: z.string().min(1),
			name: z.string().min(1),
			content: z.string().max(MAX_MESSAGE_CONTENT),
		})
		.strict(),
]);

export const PromptRunSchema = z
	.object({
		question: z.string(),
		files: z.array(z.string()).optional().default([]),
		placeholders: z.record(z.string(), z.string()).optional(),
		/**
		 * Turns after the opening question, for an agentic run. Absent for a single-shot
		 * run, which is every caller that existed before trajectory testcases.
		 */
		messages: z.array(ConversationMessageSchema).max(MAX_CONVERSATION_MESSAGES).optional(),
		/**
		 * The trace the first turn of this trajectory minted and returned. The playground's
		 * loop is client-side, so the server only learns that N requests are one trajectory
		 * because the client echoes this back; a client may not choose it.
		 */
		traceId: z.uuid().optional(),
	})
	.strict()
	// Both or neither: a continuation with no trace would log turns that nothing ties
	// together, and a trace with no conversation would log a root turn as a continuation.
	.refine((body) => (body.messages === undefined) === (body.traceId === undefined), {
		message: "messages and traceId must be sent together",
		path: ["traceId"],
	});

export type PromptRunType = z.infer<typeof PromptRunSchema>;

// The schema and the hand-written provider type must not drift.
type _ConversationMessageMatchesType =
	z.infer<typeof ConversationMessageSchema> extends ConversationMessage ? true : never;
const _assertion: _ConversationMessageMatchesType = true;
void _assertion;

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
		source: z.enum(SourceType).optional(),
		logLevel: z.enum(LogLevel).optional(),
		query: z.string().optional(),
	})
	.strict();

export type PromptLogsQueryType = z.infer<typeof PromptLogsQuerySchema>;

/**
 * Addresses one log row for the details endpoint.
 *
 * `logId` stays a string all the way to ClickHouse: it is a `UInt64`, and `z.coerce.number`
 * would round it to the nearest double and address a row that does not exist. `timestamp`
 * is not redundant with it -- the table is partitioned by month, so it is the predicate
 * that keeps the lookup off every part the organisation owns.
 */
export const LogDetailQuerySchema = z
	.object({
		logId: z.string().regex(/^\d+$/, "logId must be an unsigned integer"),
		timestamp: z.coerce.date(),
	})
	.strict();

export type LogDetailQueryType = z.infer<typeof LogDetailQuerySchema>;

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
