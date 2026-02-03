import { useState, useCallback, useMemo } from "react";
import type { SortDirection, UseSortOptions, UseSortReturn } from "../utils/types";

/**
 * Hook for managing table sorting state and logic
 *
 * @example
 * ```tsx
 * const { sortColumn, sortDirection, handleSort, sortedData } = useSort({
 *   data: apiKeys,
 *   sortFn: (a, b, column) => {
 *     if (column === "name") return a.name.localeCompare(b.name);
 *     if (column === "email") return a.email.localeCompare(b.email);
 *     return 0;
 *   }
 * });
 * ```
 */
export function useSort<T extends string, D>({
	data,
	sortFn,
}: UseSortOptions<T, D>): UseSortReturn<T, D> {
	const [sortColumn, setSortColumn] = useState<T | null>(null);
	const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

	const handleSort = useCallback((column: T) => {
		setSortColumn((prevColumn) => {
			if (prevColumn === column) {
				setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
				return prevColumn;
			} else {
				setSortDirection("asc");
				return column;
			}
		});
	}, []);

	const sortedData = useMemo(() => {
		if (!sortColumn) return data;

		return [...data].sort((a, b) => {
			const result = sortFn(a, b, sortColumn);
			return sortDirection === "asc" ? result : -result;
		});
	}, [data, sortColumn, sortDirection, sortFn]);

	return {
		sortColumn,
		sortDirection,
		handleSort,
		sortedData,
	};
}
