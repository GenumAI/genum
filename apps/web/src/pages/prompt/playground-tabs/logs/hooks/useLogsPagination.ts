import { useState } from "react";

export function useLogsPagination() {
	const [pageSize, setPageSize] = useState(10);
	const [page, setPage] = useState(1);

	const getTotalPages = (total: number) => Math.max(1, Math.ceil(total / pageSize));

	const visiblePages = (total: number) => {
		const totalPages = getTotalPages(total);

		if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
		if (page <= 3) return [1, 2, 3, 4, 5];
		if (page >= totalPages - 2) {
			return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
		}

		return [page - 2, page - 1, page, page + 1, page + 2];
	};

	const handlePageSizeChange = (value: string) => {
		setPageSize(Number(value));
		setPage(1);
	};

	return {
		page,
		setPage,
		pageSize,
		setPageSize,
		getTotalPages,
		visiblePages,
		handlePageSizeChange,
	};
}
