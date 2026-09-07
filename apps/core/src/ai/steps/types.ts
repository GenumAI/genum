/** How an expected tool call's arguments are compared against the actual ones. */
export type ArgsMatch = "exact" | "subset" | "ignore";

export type ToolCallStep = {
	kind: "tool_call";
	name: string;
	args?: Record<string, unknown>;
	argsMatch?: ArgsMatch;
	/** False for a step the author unticked: kept visible, never asserted. */
	enabled?: boolean;
	/** The tool's result in the original run. Replayed instead of executing anything. */
	recordedResult?: string;
};

export type FinalStep = {
	kind: "final";
	text: string;
	enabled?: boolean;
};

export type Step = ToolCallStep | FinalStep;

export type StepsConfig = {
	orderMatters: boolean;
};

/**
 * Order is not compared by default: agents reorder steps and retry without being wrong,
 * and a strict order turns every model upgrade into a wall of red tests.
 */
export const DEFAULT_STEPS_CONFIG: StepsConfig = { orderMatters: false };
