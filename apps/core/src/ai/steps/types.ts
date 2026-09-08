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

/**
 * A reply the author typed after the model answered. It is an input, not an output: it
 * is replayed verbatim and never compared, which is why `enabled` means something else
 * here than on the other kinds.
 *
 * `enabled === false` ends the session at this reply. A conversation cannot have a hole
 * in the middle -- skipping a reply would replay the following turn into a context that
 * never contained this one -- so the only thing unticking can mean is "stop here".
 */
export type UserStep = {
	kind: "user";
	text: string;
	enabled?: boolean;
};

export type Step = ToolCallStep | FinalStep | UserStep;

/** A turn of the conversation. `start` is the turn's first index in the flat array. */
export type Turn = {
	start: number;
	steps: Step[];
};

export type StepsConfig = {
	orderMatters: boolean;
};

/**
 * Order is not compared by default: agents reorder steps and retry without being wrong,
 * and a strict order turns every model upgrade into a wall of red tests.
 */
export const DEFAULT_STEPS_CONFIG: StepsConfig = { orderMatters: false };
