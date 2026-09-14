import type { SpanRow } from "@/types/spans";
import type { Step } from "@/types/steps";

/** One entry of a model call's `gen_ai.input.messages`, reduced to what a session needs. */
interface HistoryMessage {
	role: string;
	text: string;
	toolCalls: { id: string; name: string; args: unknown }[];
	/** The tool results the entry carries, by the id of the call they answer. */
	toolResults: { id: string; result: string }[];
}

export interface SessionHistory {
	/**
	 * The question the session opened with, as the session's first model call sent it.
	 * Undefined when no model call recorded its input.
	 */
	input?: string;
	/** The opening question as later model calls kept it in history, when that differs. */
	inputHistoryText?: string;
	/**
	 * What was said before the first recorded turn, as steps: exchanges the app held in its
	 * history but never sent as turns of their own. Empty when the recording starts at the
	 * opening question.
	 */
	before: Step[];
	/**
	 * Every reply after the opening question, in order, as the longest recorded history
	 * holds it -- older ones in their history form, the last one as it was sent.
	 */
	replies: string[];
}

/**
 * What a session's model calls say about the conversation around them.
 *
 * Each model call records the whole history it was sent, which holds two things the spans
 * of the session do not:
 *
 *  - exchanges before the first turn that reached us. A sender whose first exchange never
 *    arrived as a trace still sends it in every later call's history, and a pin that drops
 *    it replays the follow-up with no opening -- the model answers "how can I help?" to a
 *    session that had already asked its question.
 *  - how the app kept each message once it was answered. An app that attaches context to
 *    the message being answered and leaves it off older ones sends that context once; a
 *    replay that keeps the full text in history sends every earlier context again on every
 *    turn.
 *
 * Both message shapes are read: `{role, parts}` from the current conventions and
 * `{role, content}` with `tool_calls` from what most SDKs still emit.
 */
export function sessionHistory(spans: SpanRow[]): SessionHistory {
	const calls = spans
		.filter((row) => row.span_type === "chat" || row.span_type === "llm")
		.map((row) => ({ row, history: parseHistory(row.input) }))
		.filter(
			(call): call is { row: SpanRow; history: HistoryMessage[] } =>
				call.history !== null && call.history.some((entry) => entry.role === "user"),
		);

	const first = calls[0];
	if (!first) return { before: [], replies: [] };

	const firstUsers = userIndices(first.history);
	const input = first.history[firstUsers[0]].text;

	// Only when the session's first row is a reply: that is what says its first recorded
	// turn was not its first exchange. And only from that same turn's call -- a turn with no
	// model call would otherwise borrow a later turn's history, which holds the first
	// turn's own reply and tools as well.
	const before =
		spans[0]?.span_type === "user" &&
		first.row.trace_id === spans[0].trace_id &&
		firstUsers.length > 1
			? priorSteps(first.history.slice(firstUsers[0] + 1, firstUsers[firstUsers.length - 1]))
			: [];

	const longest = calls.reduce((best, call) =>
		userIndices(call.history).length > userIndices(best.history).length ? call : best,
	);
	const users = userIndices(longest.history).map((index) => longest.history[index].text);

	return {
		input,
		inputHistoryText: users[0] && users[0] !== input ? users[0] : undefined,
		before,
		replies: users.slice(1),
	};
}

/**
 * Sets `historyText` on the session's replies from the history that holds them all.
 *
 * Only when the counts agree: a history that holds a different number of replies than the
 * steps do cannot say which is which, and a reply given another reply's history form
 * would replay a conversation that never happened. The last reply is never answered
 * within the session, so it never becomes history.
 */
export function applyHistoryTexts(steps: Step[], replies: string[]): void {
	const userSteps = steps.filter((step) => step.kind === "user");
	if (userSteps.length === 0 || userSteps.length !== replies.length) return;

	userSteps.slice(0, -1).forEach((step, index) => {
		const historyText = replies[index];
		if (historyText && historyText !== step.text) step.historyText = historyText;
	});
}

function userIndices(history: HistoryMessage[]): number[] {
	return history.flatMap((entry, index) => (entry.role === "user" ? [index] : []));
}

/**
 * Exchanges from before the first recorded turn, as steps.
 *
 * Answers and tool calls are pinned unticked: they are the conversation the recorded
 * session had, not something the author chose to assert, and the recording holds only
 * what the app kept of them. Their tool results are kept, so a replay that calls the
 * same tool at the same point still has something to answer it with.
 */
function priorSteps(entries: HistoryMessage[]): Step[] {
	const results = new Map(
		entries.flatMap((entry) => entry.toolResults.map((r) => [r.id, r.result] as const)),
	);
	const steps: Step[] = [];

	for (const entry of entries) {
		if (entry.role === "user") {
			if (entry.text) steps.push({ kind: "user", text: entry.text });
			continue;
		}
		if (entry.role !== "assistant") continue;

		if (entry.text) steps.push({ kind: "final", text: entry.text, enabled: false });
		for (const call of entry.toolCalls) {
			const result = results.get(call.id);
			steps.push({
				kind: "tool_call",
				name: call.name,
				...toolArgs(call.args),
				enabled: false,
				...(result === undefined ? {} : { recordedResult: result }),
			});
		}
	}

	return steps;
}

function toolArgs(raw: unknown): Pick<Extract<Step, { kind: "tool_call" }>, "args" | "argsMatch"> {
	let value = raw;
	if (typeof raw === "string") {
		try {
			value = JSON.parse(raw);
		} catch {
			return { args: {}, argsMatch: "ignore" };
		}
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return raw === undefined ? { args: {} } : { args: {}, argsMatch: "ignore" };
	}
	return { args: value as Record<string, unknown> };
}

function parseHistory(raw: string): HistoryMessage[] | null {
	if (!raw) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed)) return null;

	return parsed.filter(isRecord).map(toHistoryMessage);
}

function toHistoryMessage(message: Record<string, unknown>): HistoryMessage {
	const parts = Array.isArray(message.parts)
		? message.parts.filter(isRecord)
		: Array.isArray(message.content)
			? message.content.filter(isRecord)
			: [];

	const text =
		typeof message.content === "string"
			? message.content
			: parts
					.filter((part) => part.type === undefined || part.type === "text")
					.map((part) =>
						typeof part.content === "string"
							? part.content
							: typeof part.text === "string"
								? part.text
								: "",
					)
					.join("");

	const toolCalls = [
		...parts
			.filter((part) => part.type === "tool_call")
			.map((part) => ({
				id: String(part.id ?? ""),
				name: String(part.name ?? ""),
				args: part.arguments,
			})),
		...(Array.isArray(message.tool_calls) ? message.tool_calls.filter(isRecord) : []).map(
			(call) => {
				const fn = isRecord(call.function) ? call.function : {};
				return {
					id: String(call.id ?? ""),
					name: String(fn.name ?? ""),
					args: fn.arguments,
				};
			},
		),
	].filter((call) => call.name);

	const toolResults = [
		...parts
			.filter((part) => part.type === "tool_call_response")
			.map((part) => ({ id: String(part.id ?? ""), result: asText(part.response) })),
		...(message.role === "tool" && typeof message.tool_call_id === "string"
			? [{ id: message.tool_call_id, result: asText(message.content) }]
			: []),
	];

	return {
		role: typeof message.role === "string" ? message.role : "",
		text: message.role === "tool" ? "" : text,
		toolCalls,
		toolResults,
	};
}

function asText(value: unknown): string {
	return typeof value === "string" ? value : JSON.stringify(value ?? null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
