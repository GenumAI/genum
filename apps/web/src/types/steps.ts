// The step shapes themselves come from @genum/steps, shared with apps/core. These two are
// core's provider types (apps/core/src/ai/providers/index.ts), which the package does not
// carry, so they are still restated here rather than imported -- apps/web does not depend
// on apps/core.

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
	| { role: "tool"; toolCallId: string; name: string; content: string }
	| { role: "user"; content: string };
