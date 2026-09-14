import type { ModelConfigParameters } from "@/ai/models/types";

/**
 * The tool subset a recorded session was actually run with.
 *
 * A prompt's tool list is what it offers TODAY; a recording says what its model was offered
 * at the time. An external app that runs its own agent loop decides that subset per user --
 * a reader is offered search, an editor is offered search and send -- so replaying a
 * reader's session against the prompt's whole list hands the model tools the recording's
 * model never had. It then calls one, the replay stops at a tool the recording cannot
 * answer, and the testcase is written NOK for a difference the author never made. The
 * quieter failure is the opposite one: the model picks a tool it now has, answers
 * differently, and the mismatch reads as a prompt regression.
 *
 * `null` and `undefined` mean the session never recorded a subset -- every testcase pinned
 * before this existed, and every sender that supplies no such attribute. Those keep the
 * whole list, which is exactly what they ran with before. An EMPTY array is a recorded
 * answer and means the model was offered no tools; it is honoured, and the `tools` key is
 * dropped entirely rather than sent as `[]`, which some providers reject.
 *
 * Names the recording carries that the prompt no longer defines are simply absent from the
 * result: a tool deleted from the prompt cannot be offered, and refusing the run over it
 * would make every older testcase unrunnable the moment a tool is renamed.
 */
export function restrictTools(
	parameters: ModelConfigParameters | undefined,
	offered: string[] | null | undefined,
): ModelConfigParameters | undefined {
	if (!parameters || !offered) return parameters;

	const allowed = new Set(offered);
	const tools = (parameters.tools ?? []).filter((tool) => allowed.has(tool.name));

	if (tools.length === 0) {
		const { tools: _dropped, ...rest } = parameters;
		return rest;
	}

	return { ...parameters, tools };
}

/**
 * The tool names a stored `offeredTools` column holds, or `null` when it holds nothing
 * usable.
 *
 * The column is `Json?`, so what comes back is `unknown` -- and the difference between "not
 * recorded" and "recorded as none" is the whole point of the field, which a lenient read
 * would erase. Anything that is not an array of strings is read as not recorded: a run that
 * offers the prompt's whole list is the behaviour every testcase had before this column
 * existed, while a misread that produced `[]` would offer the model nothing and stop every
 * replay at its first tool call.
 */
export function readOfferedTools(stored: unknown): string[] | null {
	if (!Array.isArray(stored)) return null;
	if (!stored.every((name) => typeof name === "string")) return null;
	return stored as string[];
}
