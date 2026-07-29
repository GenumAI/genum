import { z } from "zod";

export const MailServiceCreateProjectSchema = z
	.object({
		sub: z.string().min(1),
		orgId: z.number().int().positive(),
		name: z.string().min(1).max(255),
	})
	.strict();

export const MailServiceMintKeySchema = z
	.object({
		sub: z.string().min(1),
		projectId: z.number().int().positive(),
		name: z.string().min(1).max(255),
	})
	.strict();
