import { useEffect, useState } from "react";

import type { LogsFilterState } from "@/pages/logs/components/LogsFilter";
import { getDefaultDateRange } from "../utils/getDefaultDateRange";

export function useLogsFilters() {
	const [queryInput, setQueryInput] = useState("");
	const [logsFilter, setLogsFilter] = useState<LogsFilterState>(() => {
		return {
			dateRange: getDefaultDateRange(),
			logLevel: undefined,
			model: undefined,
			source: undefined,
			query: undefined,
		};
	});

	useEffect(() => {
		const timer = setTimeout(() => {
			setLogsFilter((prev) => ({ ...prev, query: queryInput.trim() || undefined }));
		}, 250);

		return () => clearTimeout(timer);
	}, [queryInput]);

	return {
		logsFilter,
		setLogsFilter,
		queryInput,
		setQueryInput,
		handleQueryChange: (value: string) => setQueryInput(value),
	};
}
