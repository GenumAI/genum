import { queryOptions } from "@tanstack/react-query";

import { projectApi } from "@/api/project/project.api";
import { logsKeys } from "@/query-keys/logs.keys";
import type { TraceSpansResponse } from "@/types/spans";
import { spansToSteps } from "./spansToSteps";
import type { MappedTrajectory } from "./spansToSteps";

/**
 * The one definition of what the `trace-spans` cache entry holds: the API's response, as
 * returned. Every reader of a session's spans goes through here.
 *
 * It used to be defined twice. The log section stored its steps under this key while
 * "Add testcase" stored the raw response under the same key -- and because a query is
 * stale the moment it lands, adding a testcase from an open log always refetched,
 * overwrote the section's steps with spans, and crashed the dialog on `steps.length`. A
 * read served from the cache failed the other way, quietly: the pin got steps where it
 * expected spans and fell back to a plain text testcase.
 */
export function traceSpansQuery(traceId: string) {
	return queryOptions({
		queryKey: logsKeys.traceSpans(traceId),
		queryFn: () => projectApi.getTraceSpans(traceId),
	});
}

/**
 * Module-level rather than inline: TanStack reruns `select` only when the data or the
 * function itself changes, so a fresh arrow per render would rebuild every step on every
 * render of the log dialog.
 */
function selectTrajectory(response: TraceSpansResponse): MappedTrajectory {
	return spansToSteps(response.spans ?? []);
}

/**
 * The session's spans as the steps a log renders. Same cache entry as `traceSpansQuery`,
 * transformed per observer by `select`, which never writes back to the cache.
 */
export function trajectoryQuery(traceId: string) {
	return queryOptions({ ...traceSpansQuery(traceId), select: selectTrajectory });
}
