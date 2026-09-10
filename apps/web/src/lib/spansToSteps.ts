import type { SpanRow } from "@/types/spans";
import type { Step, ToolCallStep } from "@/types/steps";

export interface MappedTrajectory {
	steps: Step[];
	/**
	 * Indices into `steps` whose recorded `tool_args` could not be parsed and were
	 * degraded to `{ args: {}, argsMatch: "ignore" }` (see `parseToolArgs`). This is a
	 * UI-only hint so the picker can say "we could not read this" instead of rendering the
	 * same `{}` a genuine no-args call would produce. It is deliberately NOT part of
	 * `Step` -- `StepSchema` on the server is `.strict()`, and `expectedSteps` is copied
	 * verbatim into Postgres, so an extra field on a step would either be rejected at the
	 * boundary or persisted as junk. Keeping it out-of-band means it can never reach the
	 * `createTestcase` payload, which is built only from the `steps` array.
	 */
	unreadableArgsIndices: Set<number>;
}

/**
 * The inverse of `toSpanRows` in apps/core/src/services/logger/spans.ts: turns the rows of
 * a recorded trace back into the trajectory the author picks from.
 *
 * Rows arrive already ordered by `span_index` from the read path, so the order is left
 * alone here -- re-sorting would silently paper over a read path that stopped ordering.
 * A trailing `final` step is not assumed either: a trajectory whose last turn still asked
 * for a tool has none, and that is a legitimate trace, not a broken one.
 *
 * Ordering is therefore the SENDER's contract, and it has one non-obvious clause: a `chat`
 * span that wraps a whole turn starts before the tool spans inside it, which would put the
 * turn's answer ahead of the tool calls that produced it. A sender must start its answering
 * `chat` span at the last model call, not at the top of the turn. Re-sorting here cannot
 * fix it -- this side is given a flat, already-ordered session and deliberately has no
 * `turn_index` to group by (see `types/spans.ts`).
 *
 * `recordedResult` rides through untouched. It is what makes the resulting testcase
 * replayable after the ClickHouse rows age out -- the picked steps are COPIED into the
 * testcase, never referenced.
 */
export function spansToSteps(spans: SpanRow[]): MappedTrajectory {
	const unreadableArgsIndices = new Set<number>();
	const steps: Step[] = [];

	for (const row of spans) {
		if (row.span_type === "user") {
			steps.push({ kind: "user", text: row.output });
			continue;
		}

		if (row.span_type === "execute_tool" || row.span_type === "tool") {
			const { degraded, ...args } = parseToolArgs(row.tool_args);
			// Indexed against the steps PRODUCED, not against the span it came from. The
			// two used to be the same number because every span became a step; now that
			// some do not, using the span's position would mark the wrong row as
			// unreadable -- or a row that does not exist.
			if (degraded) {
				unreadableArgsIndices.add(steps.length);
			}

			steps.push({
				kind: "tool_call",
				name: row.name.startsWith("execute_tool ")
					? row.name.slice("execute_tool ".length)
					: row.name,
				...args,
				recordedResult: row.tool_result,
			});
			continue;
		}

		if (row.span_type === "chat" || row.span_type === "llm") {
			// A model call that only asked for tools is not an answer. Its output has no
			// text part, so `answerText` stored "" for it -- and turning that into a
			// `final` step pinned an expectation of the empty string in the middle of a
			// turn, which no replay can ever satisfy. The turn's real answer is the chat
			// span that produced text.
			if (!row.output) continue;

			steps.push({ kind: "final", text: row.output });
		}

		// Anything else -- `invoke_agent`, `embeddings`, an operation name we do not model,
		// or a sender that set none at all -- is stored and shown, but is not a step. It
		// used to become a `final`, so a session instrumented by a standard SDK pinned its
		// embedding calls as expected answers.
	}

	return { steps, unreadableArgsIndices };
}

/**
 * Whether a recorded session is nothing but one answer to one question.
 *
 * Every run now opens a session, so a plainly answered question records a trace too --
 * a single `final` span carrying the same text the log's output field already shows.
 * That is worth recording (it is what makes the answer continuable) but not worth
 * showing as a trajectory or picking steps from: the picker would offer one row
 * duplicating the testcase's own expected output, and pinning it asserts nothing the
 * plain text testcase underneath does not already assert.
 *
 * A second turn changes that even with no tool in sight -- two questions and two answers
 * are a shape a text testcase cannot express -- so the test is on the step COUNT, not on
 * the presence of a tool call.
 */
export function isSingleAnswer(steps: Step[]): boolean {
	return steps.length === 0 || (steps.length === 1 && steps[0].kind === "final");
}

/**
 * A ClickHouse row is not trusted input: `tool_args` can be malformed or truncated, and
 * `JSON.parse` throws on both. One bad row must not take down the whole dialog, so a
 * value we cannot read degrades to empty arguments pinned as `argsMatch: "ignore"`.
 *
 * Dropping the step instead would be worse: the author would silently pin a trajectory
 * that is missing a call the agent actually made. Keeping it with `"exact"` would be
 * worse still -- it would assert `{}` as the expected arguments and fail every honest
 * run. Ignoring the arguments asserts what we do know (the call happened, by this name)
 * and nothing we do not. The author can still see the step and untick it -- and, via
 * `degraded`, see that the recorded arguments themselves could not be read.
 */
function parseToolArgs(
	raw: string,
): Pick<ToolCallStep, "args" | "argsMatch"> & { degraded: boolean } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { args: {}, argsMatch: "ignore", degraded: true };
	}

	// `null`, an array or a scalar all parse fine but are not an argument object.
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return { args: {}, argsMatch: "ignore", degraded: true };
	}

	return { args: parsed as Record<string, unknown>, degraded: false };
}
