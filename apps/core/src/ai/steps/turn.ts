import type { ConversationMessage, ToolCall } from "@/ai/providers";
import type { Step, ToolCallStep } from "./types";

/**
 * The steps one playground turn COMPLETED, and where they sit in the trace.
 *
 * The playground's agentic loop runs in the browser: the model asks for a tool on turn N
 * and the author types its result in before turn N+1. A `tool_call` step is therefore
 * only whole -- args AND `recordedResult` -- one turn after the model asked for it, and
 * `trace_spans` is append-only, so a span written the moment the model asked could never
 * be completed afterwards. Each turn instead writes the calls that the conversation it
 * just carried has now answered, plus the final answer once the model stops asking.
 *
 * The offset is derived from the conversation itself rather than from any server-side
 * state: the client sends every turn so far on every request, so N stateless HTTP calls
 * still produce one correctly ordered trace.
 */
export function completedTurnSteps(
	messages: ConversationMessage[] | undefined,
	response: { answer: string; toolCalls?: ToolCall[] },
): { steps: Step[]; spanIndexOffset: number } {
	const conversation = messages ?? [];
	const assistantTurns = conversation.filter((message) => message.role === "assistant");
	const lastTurn = assistantTurns[assistantTurns.length - 1];

	// Every call from every assistant turn BEFORE the last one already has its span; the
	// last turn's calls are the ones this request carried results for.
	const spanIndexOffset = assistantTurns
		.slice(0, -1)
		.reduce((sum, turn) => sum + (turn.toolCalls?.length ?? 0), 0);

	const recordedResults = new Map<string, string>();
	for (const message of conversation) {
		if (message.role === "tool") {
			recordedResults.set(message.toolCallId, message.content);
		}
	}

	const steps: Step[] = (lastTurn?.toolCalls ?? []).map(
		(call): ToolCallStep => ({
			kind: "tool_call",
			name: call.name,
			args: call.args,
			recordedResult: recordedResults.get(call.id),
		}),
	);

	// The model asked for nothing further, so this answer ends the trajectory.
	if (!response.toolCalls || response.toolCalls.length === 0) {
		steps.push({ kind: "final", text: response.answer });
	}

	return { steps, spanIndexOffset };
}
