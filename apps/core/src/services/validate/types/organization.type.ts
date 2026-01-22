import { z } from "zod";
import {
	OrganizationSchema as OrganizationSchemaGenerated,
	OrganizationMemberSchema,
	OrganizationApiKeySchema,
} from "@/prisma-types";
import { AiVendor, OrganizationRole } from "@/prisma";

const OrganizationSchema = OrganizationSchemaGenerated.extend({
	name: z.string().trim().min(1).max(128),
	description: z.string().trim().max(7_000).default(""),
});

export const OrganizationCreateSchema = OrganizationSchema.omit({
	id: true,
	personal: true,
}).strict();

export type OrganizationCreateType = z.infer<typeof OrganizationCreateSchema>;

export const OrganizationUpdateSchema = OrganizationCreateSchema.partial().strict();

export type OrganizationUpdateType = z.infer<typeof OrganizationUpdateSchema>;

export const OrganizationMemberUpdateSchema = OrganizationMemberSchema.omit({
	id: true,
	organizationId: true,
	userId: true,
})
	.extend({
		role: z.enum(OrganizationRole),
	})
	.strict();

export type OrganizationMemberUpdateType = z.infer<typeof OrganizationMemberUpdateSchema>;

export const OrganizationMemberInviteSchema = z
	.object({
		email: z.email({ message: "Invalid email address" }),
		// role: z.enum(OrganizationRole).default(OrganizationRole.READER),
		// feature: teamwork
		role: z.enum(OrganizationRole).default(OrganizationRole.ADMIN),
	})
	.strict();

export type OrganizationMemberInviteType = z.infer<typeof OrganizationMemberInviteSchema>;

export const OrganizationApiKeyCreateSchema = OrganizationApiKeySchema.pick({
	vendor: true,
	key: true,
}).strict();

export type OrganizationApiKeyCreateType = z.infer<typeof OrganizationApiKeyCreateSchema>;

export const OrganizationUsageStatsSchema = z
	.object({
		fromDate: z.coerce.date(),
		toDate: z.coerce.date(),
		projectId: z.coerce.number().int().positive().optional(),
	})
	.partial()
	.strict();

export type OrganizationUsageStatsType = z.infer<typeof OrganizationUsageStatsSchema>;

// ==================== Custom Provider Schemas ====================

/**
 * Schema for creating/updating the custom OpenAI-compatible provider
 * Note: Only one custom provider per organization is allowed
 */
export const CustomProviderApiKeyCreateSchema = z
	.object({
		vendor: z.literal(AiVendor.CUSTOM_OPENAI_COMPATIBLE),
		key: z.string().default(""), // Optional - some providers don't need API key
		name: z.string().trim().max(255).optional(), // Optional display name
		baseUrl: z.url("Invalid URL format").max(512),
	})
	.strict();

export type CustomProviderApiKeyCreateType = z.infer<typeof CustomProviderApiKeyCreateSchema>;

/**
 * Schema for testing provider connection
 * Note: apiKey is optional for providers that don't require authentication
 */
export const TestProviderConnectionSchema = z
	.object({
		apiKey: z.string().default(""), // Optional - use empty string for no-auth providers
		baseUrl: z.url("Invalid URL format").max(512),
	})
	.strict();

export type TestProviderConnectionType = z.infer<typeof TestProviderConnectionSchema>;

/**
 * Schema for syncing models from a custom provider
 */
export const SyncProviderModelsSchema = z
	.object({
		apiKeyId: z.coerce.number().int().positive(),
		removeStale: z.boolean().default(false),
	})
	.strict();

export type SyncProviderModelsType = z.infer<typeof SyncProviderModelsSchema>;

/**
 * Schema for a single parameter configuration
 */
export const ModelParameterConfigSchema = z.object({
	enabled: z.boolean().default(true),
	min: z.number().min(0).optional(),
	max: z.number().min(0).optional(),
	default: z.union([z.number().min(0), z.string()]).optional(),
	allowed: z.array(z.string()).optional(),
});

export type ModelParameterConfigType = z.infer<typeof ModelParameterConfigSchema>;

/**
 * Schema for updating model parameters configuration
 */
export const UpdateModelParametersConfigSchema = z.object({
	parametersConfig: z.record(z.string(), ModelParameterConfigSchema),
});

export type UpdateModelParametersConfigType = z.infer<typeof UpdateModelParametersConfigSchema>;

/**
 * Schema for updating a custom model (display name, prices, etc.)
 */
export const UpdateCustomModelSchema = z
	.object({
		displayName: z.string().trim().max(255).optional(),
		promptPrice: z.number().min(0).optional(),
		completionPrice: z.number().min(0).optional(),
		contextTokensMax: z.number().int().min(0).optional(),
		completionTokensMax: z.number().int().min(0).optional(),
		description: z.string().max(1000).optional(),
		parametersConfig: z.record(z.string(), ModelParameterConfigSchema).optional(),
	})
	.strict();

export type UpdateCustomModelType = z.infer<typeof UpdateCustomModelSchema>;
