import { TestCaseSchema as TestCaseSchemaGenerated, TestCaseStatusSchema } from "@/prisma-types";
import { z } from "zod";

const nameSchema = z.string().trim().min(1).max(128);
const TestCaseSchema = TestCaseSchemaGenerated.extend({
	name: nameSchema,
});

export const TestcasesCreateSchema = TestCaseSchema.omit({
	id: true,
	status: true,
	createdAt: true,
	updatedAt: true,
})
	.extend({
		promptId: z.number(),
		assertionThoughts: z.string().optional(),
		expectedChainOfThoughts: z.string().optional(),
		lastChainOfThoughts: z.string().optional(),
		memoryId: z.number().nullable().optional(),
	})
	.strict();

export type TestcasesCreateType = z.infer<typeof TestcasesCreateSchema>;

export const TestcasesCreateWithoutNameSchema = TestcasesCreateSchema.omit({
	name: true,
})
	.extend({
		name: nameSchema.optional(),
		files: z.array(z.string()).optional(), // Array of file IDs
	})
	.strict();
export type TestcasesCreateWithoutNameType = z.infer<typeof TestcasesCreateWithoutNameSchema>;

export const TestcasesUpdateSchema = TestCaseSchema.omit({
	id: true,
	promptId: true,
	createdAt: true,
	updatedAt: true,
})
	.extend({
		status: TestCaseStatusSchema.optional(),
	})
	.partial()
	.strict();

export type TestcasesUpdateType = z.infer<typeof TestcasesUpdateSchema>;
