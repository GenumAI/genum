import { z } from "zod";
import type { Step, StepsConfig } from "./types";

/**
 * Boundary validation for the trajectory a testcase pins. The Prisma column is `Json?`,
 * which the generated zod schema types as `unknown` -- anything at all would otherwise
 * reach the assertion, where a malformed step is a silent pass rather than a 400.
 */
export const ArgsMatchSchema = z.enum(["exact", "subset", "ignore"]);

export const ToolCallStepSchema = z
	.object({
		kind: z.literal("tool_call"),
		name: z.string().min(1),
		args: z.record(z.string(), z.unknown()).optional(),
		argsMatch: ArgsMatchSchema.optional(),
		enabled: z.boolean().optional(),
		/** Replayed instead of executing the tool, so it is copied into the testcase. */
		recordedResult: z.string().optional(),
	})
	.strict();

export const FinalStepSchema = z
	.object({
		kind: z.literal("final"),
		text: z.string(),
		enabled: z.boolean().optional(),
	})
	.strict();

export const StepSchema = z.discriminatedUnion("kind", [ToolCallStepSchema, FinalStepSchema]);

export const StepsSchema = z.array(StepSchema);

/**
 * The one definition of "this trajectory asserts something". `enabled` is optional and
 * absent means enabled (see ToolCallStep/FinalStep in ./types.ts), which is why the
 * predicate is `!== false` and not `=== true` -- the same test `compareSteps` applies.
 * Shared by the write boundary (`EnabledStepsSchema`) and the read boundary
 * (`readExpectedSteps`) so the two halves cannot drift into an always-green testcase.
 */
export function hasEnabledStep(steps: readonly { enabled?: boolean }[]): boolean {
	return steps.some((step) => step.enabled !== false);
}

export const StepsConfigSchema = z.object({ orderMatters: z.boolean() }).strict();

// The schemas and the hand-written types must not drift: these fail to compile if they do.
type _StepsMatchTypes = z.infer<typeof StepSchema> extends Step ? true : never;
type _ConfigMatchesType = z.infer<typeof StepsConfigSchema> extends StepsConfig ? true : never;
const _assertions: [_StepsMatchTypes, _ConfigMatchesType] = [true, true];
void _assertions;
