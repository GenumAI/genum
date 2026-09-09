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
/**
 * Whether this conversation is one `completedTurnSteps` can number, and what is wrong
 * with it if not. Returns `null` for a conversation that is fine.
 *
 * `completedTurnSteps` derives BOTH the emitted steps and `spanIndexOffset` from the
 * shape of `messages` alone -- there is no server-side state to check it against -- and
 * `trace_spans` is append-only, so a mis-numbered turn can never be corrected. The
 * numbering assumes the shape the playground actually produces: a turn ends when the
 * model answers, so the model's answer is in the conversation as an assistant message
 * with no tool calls, and only then does the author's reply follow.
 *
 * `[assistant(toolCalls), tool, user]` -- exactly what a pre-fix web bundle sent, and
 * what any third-party caller of `/prompts/:id/run` may send -- satisfies every
 * per-message rule `PromptRunSchema` has and still breaks the numbering: the last
 * assistant turn is the tool-call one, so its calls are emitted a SECOND time, and the
 * offset counts one span for a reply on an index the turn's `final` already occupies.
 *
 * This is a rejection rather than a repair on purpose. There is no way to tell which of
 * the two readings the caller meant -- an answer that was never sent, or a reply sent
 * too early -- and writing either guess into an append-only table is worse than
 * refusing: a 400 the caller can fix beats a trace nobody can.
 */
export function conversationNumberingProblem(
	messages: ConversationMessage[] | undefined,
): string | null {
	if (!messages) {
		return null;
	}

	// Every `user` message here is a REPLY -- the opening question travels in `question`,
	// not in `messages` -- so each one closes a turn that the model must already have
	// answered. The check runs over all of them, not just a trailing one: a reply in the
	// middle mis-numbers every span after it just as thoroughly.
	for (let index = 0; index < messages.length; index++) {
		if (messages[index].role !== "user") {
			continue;
		}
		const previous = messages[index - 1];
		if (previous?.role !== "assistant" || previous.toolCalls?.length) {
			return `the reply at message ${index + 1} does not follow an assistant answer: a continuation must carry every earlier turn's answer, or its trace cannot be numbered`;
		}
	}

	return null;
}

export function completedTurnSteps(
	messages: ConversationMessage[] | undefined,
	response: { answer: string; toolCalls?: ToolCall[] },
): { steps: Step[]; spanIndexOffset: number } {
	const conversation = messages ?? [];
	const assistantTurns = conversation.filter((message) => message.role === "assistant");
	const lastTurn = assistantTurns[assistantTurns.length - 1];

	// Every span an earlier turn wrote, not only its tool calls: a turn that answered
	// plainly wrote an `llm` span, and each reply wrote a `user` span. `trace_spans` is
	// append-only and ordered by this index, so undercounting writes this turn's rows onto
	// indices that are already taken.
	const earlierTurns = assistantTurns.slice(0, -1);
	const spanIndexOffset =
		earlierTurns.reduce(
			(sum, turn) => sum + (turn.toolCalls?.length ? turn.toolCalls.length : 1),
			0,
		) + conversation.filter((message) => message.role === "user").length;

	const recordedResults = new Map<string, string>();
	for (const message of conversation) {
		if (message.role === "tool") {
			recordedResults.set(message.toolCallId, message.content);
		}
	}

	// The reply that opened this turn, emitted on the one request it triggered -- the request
	// whose conversation ENDS with it, because nothing has answered it yet. One request later
	// the same reply is still in the conversation, and any rule that finds it by scanning
	// would write its span a second time.
	//
	// It is derived here rather than in the controller for the same reason everything else in
	// this function is: the conversation is the only state, and a reply recorded anywhere else
	// would not survive the next stateless request.
	const lastMessage = conversation[conversation.length - 1];

	const steps: Step[] = [];
	if (lastMessage?.role === "user") {
		steps.push({ kind: "user", text: lastMessage.content });
	}

	steps.push(
		...(lastTurn?.toolCalls ?? []).map(
			(call): ToolCallStep => ({
				kind: "tool_call",
				name: call.name,
				args: call.args,
				recordedResult: recordedResults.get(call.id),
			}),
		),
	);

	// The model asked for nothing further, so this answer ends the trajectory.
	if (!response.toolCalls || response.toolCalls.length === 0) {
		steps.push({ kind: "final", text: response.answer });
	}

	return { steps, spanIndexOffset };
}
