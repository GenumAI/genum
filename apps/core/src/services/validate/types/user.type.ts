import { UserSchema as UserSchemaGenerated } from "@/prisma-types";
import { emailSchema } from "@/utils/email";
import { z } from "zod";

const UserSchema = UserSchemaGenerated.extend({
	name: z.string().trim().min(1).max(128),
});

export const UserUpdateSchema = UserSchema.pick({
	name: true,
})
	.partial()
	.strict();

export type UserUpdateType = z.infer<typeof UserUpdateSchema>;

export const FeedbackCreateSchema = z
	.object({
		type: z.string(),
		subject: z
			.string()
			.min(1, { message: "Subject is required" })
			.max(128, { message: "Subject must be 128 characters or fewer" }),
		message: z
			.string()
			.min(1, { message: "Message is required" })
			.max(2500, { message: "Message must be 2500 characters or fewer" }),
	})
	.strict();

export type FeedbackCreateType = z.infer<typeof FeedbackCreateSchema>;

export const LocalUserRegisterSchema = z
	.object({
		email: emailSchema,
		name: z.string(),
		password: z.string().min(8),
	})
	.strict();
export type LocalUserRegisterType = z.infer<typeof LocalUserRegisterSchema>;

export const LocalUserLoginSchema = z
	.object({
		email: emailSchema,
		password: z.string().min(8),
	})
	.strict();
export type LocalUserLoginType = z.infer<typeof LocalUserLoginSchema>;
