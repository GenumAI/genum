import { useQuery } from "@tanstack/react-query";

import { projectApi } from "@/api/project";
import { promptApi } from "@/api/prompt";
import type { Log, LogDetail } from "@/types/logs";
import { logsKeys } from "@/query-keys/logs.keys";

interface UseLogDetailParams {
	/** The row the dialog is showing, or null when it is closed. */
	log: Log | null;
	enabled: boolean;
	/**
	 * A prompt's logs are scoped by the prompt; the project logs page spans prompts and is
	 * scoped by the project instead. Passing the prompt id here is what tells the two
	 * apart -- it is not merely a hint, the two endpoints enforce different boundaries.
	 */
	promptId?: number;
}

/**
 * Fetches the payload (`in`, `out`, `placeholders`) of the one row the details dialog is
 * showing. The list itself no longer carries it: a page of ten used to drag the full
 * prompt and full model answer of every scanned row out of ClickHouse, which is what made
 * `GET /prompts/:id/logs` exceed the query memory limit in production.
 */
export function useLogDetail({ log, enabled, promptId }: UseLogDetailParams) {
	const logId = log?.log_id;
	const timestamp = log?.timestamp;

	const detailQuery = useQuery<LogDetail>({
		queryKey: logsKeys.logDetail({ promptId, logId, timestamp }),
		enabled: Boolean(enabled && logId && timestamp),
		// The row is immutable -- ClickHouse logs are append-only -- so reopening a dialog
		// should never re-fetch it.
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: async () => {
			const params = { logId: logId as string, timestamp: timestamp as string };
			return promptId === undefined
				? projectApi.getLogDetail(params)
				: promptApi.getLogDetail(promptId, params);
		},
	});

	return {
		logDetail: detailQuery.data ?? null,
		isLoadingLogDetail: detailQuery.isPending && detailQuery.fetchStatus !== "idle",
		isLogDetailError: detailQuery.isError,
	};
}
