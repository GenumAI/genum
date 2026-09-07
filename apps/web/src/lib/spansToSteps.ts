import type { SpanRow } from "@/types/spans";
import type { Step, ToolCallStep } from "@/types/steps";

/**
 * The inverse of `toSpanRows` in apps/core/src/services/logger/spans.ts: turns the rows of
 * a recorded trace back into the trajectory the author picks from.
 *
 * Rows arrive already ordered by `span_index` from the read path, so the order is left
 * alone here -- re-sorting would silently paper over a read path that stopped ordering.
 * A trailing `final` step is not assumed either: a trajectory whose last turn still asked
 * for a tool has none, and that is a legitimate trace, not a broken one.
 *
 * `recordedResult` rides through untouched. It is what makes the resulting testcase
 * replayable after the ClickHouse rows age out -- the picked steps are COPIED into the
 * testcase, never referenced.
 */
export function spansToSteps(spans: SpanRow[]): Step[] {
	return spans.map((row) =>
		row.span_type === "tool"
			? {
					kind: "tool_call" as const,
					name: row.name,
					...parseToolArgs(row.tool_args),
					recordedResult: row.tool_result,
				}
			: { kind: "final" as const, text: row.output },
	);
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
 * and nothing we do not. The author can still see the step and untick it.
 */
function parseToolArgs(raw: string): Pick<ToolCallStep, "args" | "argsMatch"> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { args: {}, argsMatch: "ignore" };
	}

	// `null`, an array or a scalar all parse fine but are not an argument object.
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return { args: {}, argsMatch: "ignore" };
	}

	return { args: parsed as Record<string, unknown> };
}
