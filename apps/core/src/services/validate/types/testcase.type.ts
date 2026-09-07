import { TestCaseSchema as TestCaseSchemaGenerated, TestCaseStatusSchema } from "@/prisma-types";
import { z } from "zod";
import { hasEnabledStep, StepsConfigSchema, StepsSchema } from "@/ai/steps/schema";

const nameSchema = z.string().trim().min(1).max(128);

// `.min(1)` only bounds the array length. `compareSteps` (apps/core/src/ai/steps/compare.ts)
// skips every step with `enabled === false` -- both the ordered and unordered paths -- so an
// array of five all-unticked steps has length 5 and asserts nothing. `enabled` is optional and
// absent means enabled (see ToolCallStep/FinalStep in apps/core/src/ai/steps/types.ts), so the
// predicate has to be `!== false`, matching what compareSteps itself reads, not `=== true`.
const EnabledStepsSchema = StepsSchema.min(1).refine(
	hasEnabledStep,
	"at least one step must be enabled",
);
const TestCaseSchema = TestCaseSchemaGenerated.extend({
	name: nameSchema,
});

export const TestcasesCreateSchema = TestCaseSchema.omit({
	id: true,
	status: true,
	createdAt: true,
	updatedAt: true,
	// Written by a run, never by a client -- `.strict()` rejects it if one sends it.
	lastSteps: true,
	// Same boundary: derived from a run, never sent by a client. Omitting it also keeps
	// it out of `TestcasesCreateType`, so `newTestcase` cannot leak an `unknown` into the
	// `Json?` column Prisma expects `InputJsonValue | DbNull` for.
	lastMismatches: true,
	// Same boundary: when the last run happened is something the server observed, not
	// something a client may claim. It is the one field that keeps a stale verdict honest
	// against edited expectations, so a client that could set it could hide exactly that.
	lastRunAt: true,
})
	.extend({
		promptId: z.number(),
		assertionThoughts: z.string().optional(),
		expectedChainOfThoughts: z.string().optional(),
		lastChainOfThoughts: z.string().optional(),
		placeholders: z.record(z.string(), z.string()).optional(),
		// The generated schema types a `Json?` column as `unknown`, which would let any
		// shape at all into the column and only surface at assertion time, where a
		// malformed step silently asserts nothing. Validate the trajectory here instead.
		// `lastSteps` is deliberately absent: it is written by a run, never by a client.
		//
		// An empty array is truthy, so it would take the trajectory path and then match
		// everything; an array of unticked steps is non-empty but still matches everything,
		// because `compareSteps` skips disabled steps. `EnabledStepsSchema` rejects both --
		// a testcase that can never fail, which is the exact failure this feature exists to
		// prevent. A testcase that pins nothing is a text testcase, and a text testcase
		// leaves `expectedSteps` unset.
		expectedSteps: EnabledStepsSchema.optional(),
		stepsConfig: StepsConfigSchema.optional(),
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
	// Written by a run, never by a client -- `.strict()` rejects it if one sends it. The
	// generated base schema carries it as a plain nullish `unknown` (it mirrors the `Json?`
	// column with no boundary of its own), so it must be omitted explicitly here or
	// `.strict()` would wave it through instead of rejecting it.
	lastMismatches: true,
	// Same boundary, and the same generated-schema caveat: written by a run, never sent
	// by a client. An editable "last run" timestamp would let an edit pass itself off as
	// a run, which is the deception this column exists to prevent.
	lastRunAt: true,
})
	.extend({
		status: TestCaseStatusSchema.optional(),
		placeholders: z.record(z.string(), z.string()).optional(),
		// Same boundary as create: an edited trajectory is validated, not trusted.
		// `lastSteps` is writable here, as `lastOutput` always has been -- it is the
		// last run's trajectory, and a run writes it through this same method. `lastSteps`
		// is what a run recorded, not what an author asserts, so it is not put through
		// `EnabledStepsSchema` -- an all-disabled `lastSteps` is just a run with nothing
		// enabled at the time, not a boundary violation.
		//
		// `null` is how a client says "clear the trajectory": the testcase goes back to
		// being the plain text one it was before any steps were pinned. The repository
		// turns it into `Prisma.DbNull`. `undefined` still means "leave it alone".
		expectedSteps: EnabledStepsSchema.nullable().optional(),
		lastSteps: StepsSchema.optional(),
		stepsConfig: StepsConfigSchema.nullable().optional(),
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
		files: z.array(z.string()).optional(),
		placeholders: z.record(z.string(), z.string()).optional(),
	})
	.strict();

export type TestcaseRunType = z.infer<typeof TestcaseRunSchema>;
