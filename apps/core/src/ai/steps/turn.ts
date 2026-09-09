import type { ConversationMessage, ToolCall } from "@/ai/providers";
import type { Step } from "./types";

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

/**
 * The steps of one playground turn, or `null` while the turn is still running.
 *
 * The playground's agentic loop runs in the BROWSER: the model asks for a tool, the author
 * types its result in, and the whole conversation comes back on the next request. A turn
 * therefore spans several requests, and only the request the model answers on knows the
 * whole turn.
 *
 * That is why the turn is written here, once, at its end. Writing each request's fragment
 * as it arrived is what forced a writer to know how many spans preceded it -- and
 * `trace_spans` is append-only, so a writer that got that number wrong could never be
 * corrected. A turn that owns its own numbering cannot get it wrong.
 *
 * The price is that an abandoned turn records no steps. Its `logs` rows are written per
 * request regardless, so no usage and no cost is lost -- only the step detail of a turn
 * nobody finished, which was never pinnable as an expectation anyway.
 */
export function finishedTurnSteps(
	messages: ConversationMessage[] | undefined,
	response: { answer: string; toolCalls?: ToolCall[] },
): { steps: Step[]; turnIndex: number } | null {
	// The model asked for more tools: the turn continues, and its steps are not all known.
	if (response.toolCalls && response.toolCalls.length > 0) {
		return null;
	}

	const conversation = messages ?? [];

	// Each reply opens a turn, and the opening question travels in `question` rather than
	// in `messages`, so the number of replies IS this turn's ordinal.
	const replyIndices = conversation
		.map((message, index) => (message.role === "user" ? index : -1))
		.filter((index) => index !== -1);
	const turnIndex = replyIndices.length;

	// This turn starts at the reply that opened it. Everything before belongs to turns
	// whose spans are already written, under their own traces.
	const start = replyIndices.length > 0 ? replyIndices[replyIndices.length - 1] : 0;
	const turnMessages = conversation.slice(start);

	const recordedResults = new Map<string, string>();
	for (const message of turnMessages) {
		if (message.role === "tool") {
			recordedResults.set(message.toolCallId, message.content);
		}
	}

	const steps: Step[] = [];
	const opening = turnMessages[0];
	if (opening?.role === "user") {
		steps.push({ kind: "user", text: opening.content });
	}

	for (const message of turnMessages) {
		if (message.role !== "assistant") {
			continue;
		}
		for (const call of message.toolCalls ?? []) {
			steps.push({
				kind: "tool_call",
				name: call.name,
				args: call.args,
				recordedResult: recordedResults.get(call.id),
			});
		}
	}

	steps.push({ kind: "final", text: response.answer });

	return { steps, turnIndex };
}
