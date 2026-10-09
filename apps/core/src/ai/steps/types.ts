// The step shapes live in @genum/steps, which apps/web imports too. This module keeps the
// `@/ai/steps/types` path every core import site already uses.
export { DEFAULT_STEPS_CONFIG } from "@genum/steps";
export type {
	ArgsMatch,
	FinalStep,
	Step,
	StepsConfig,
	ToolCallStep,
	Turn,
	UserStep,
} from "@genum/steps";
