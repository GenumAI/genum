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
		placeholders: z.record(z.string(), z.string()).optional(),
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
		placeholders: z.record(z.string(), z.string()).optional(),
	})
	.partial()
	.strict();

export type TestcasesUpdateType = z.infer<typeof TestcasesUpdateSchema>;

// Mirrors what the client actually sends (RunTestcaseData in testcases.api.ts): the
// full run-params shape shared with the direct-prompt run path, not just the one field
// this controller happens to act on. `.strict()` means every field the client can send
// must be declared here even when the controller ignores it (question/files -- this
// endpoint uses the testcase's own input and files) -- a schema that declares only
// `placeholders` rejects the real request body with a 400, which is exactly the
// regression this comment is here to keep from recurring.
//
// An explicit selection in the run request beats the testcase's pinned one (Task 8) --
// see TestcasesController.runTestcase. Absent (not an empty object) means "use the pin".
export const TestcaseRunSchema = z
	.object({
		question: z.string().optional(),
		memoryId: z.number().optional(),
		files: z.array(z.string()).optional(),
		placeholders: z.record(z.string(), z.string()).optional(),
	})
	.strict();

export type TestcaseRunType = z.infer<typeof TestcaseRunSchema>;
