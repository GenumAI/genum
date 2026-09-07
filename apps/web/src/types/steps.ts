// apps/web does not depend on apps/core, so these shapes are restated here rather than
// imported -- the same reason @genum/placeholders exists as a shared package instead of
// letting the web app reach into core's src.

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

export type StepsConfig = { orderMatters: boolean };

/**
 * One tool call, in the same shape for every vendor -- mirrors `ToolCall` in
 * apps/core/src/ai/providers/index.ts.
 */
export type ToolCall = {
	id: string;
	name: string;
	args: Record<string, unknown>;
};

/**
 * Turns after the opening question, sent back to the run endpoint so the model sees the
 * tool results the author supplied. Mirrors `ConversationMessage` in
 * apps/core/src/ai/providers/index.ts.
 */
export type ConversationMessage =
	| { role: "assistant"; content: string; toolCalls?: ToolCall[] }
	| { role: "tool"; toolCallId: string; name: string; content: string };

/**
 * One expected step the last run did not match. `index` points into the testcase's
 * `expectedSteps`. Mirrors `StepMismatch` in apps/core/src/ai/steps/compare.ts -- restated
 * rather than imported, for the same reason the shapes above are.
 */
export type StepMismatch = {
	index: number;
	reason: string;
};
