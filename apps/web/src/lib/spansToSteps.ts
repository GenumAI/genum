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
 * `recordedResult` rides through untouched. It is what makes the resulting testcase
 * replayable after the ClickHouse rows age out -- the picked steps are COPIED into the
 * testcase, never referenced.
 */
export function spansToSteps(spans: SpanRow[]): MappedTrajectory {
	const unreadableArgsIndices = new Set<number>();

	const steps: Step[] = spans.map((row, index) => {
		if (row.span_type !== "tool") {
			return { kind: "final" as const, text: row.output };
		}

		const { degraded, ...args } = parseToolArgs(row.tool_args);
		if (degraded) {
			unreadableArgsIndices.add(index);
		}

		return {
			kind: "tool_call" as const,
			name: row.name,
			...args,
			recordedResult: row.tool_result,
		};
	});

	return { steps, unreadableArgsIndices };
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
