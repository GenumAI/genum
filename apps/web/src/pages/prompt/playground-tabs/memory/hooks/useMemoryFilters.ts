import type { SortingState } from "@tanstack/react-table";
import type { Memory } from "@/api/prompt";
import { useEffect, useMemo, useRef, useState } from "react";

interface UseMemoryFiltersOptions {
	memories: Memory[];
	promptId?: string;
}

export const useMemoryFilters = ({ memories, promptId }: UseMemoryFiltersOptions) => {
	const [search, setSearch] = useState("");
	const [sorting, setSorting] = useState<SortingState>([]);
	const previousPromptIdRef = useRef(promptId);

	useEffect(() => {
		if (previousPromptIdRef.current !== promptId) {
			setSearch("");
			setSorting([]);
			previousPromptIdRef.current = promptId;
		}
	}, [promptId]);

	const filteredMemories = useMemo(() => {
		const query = search.toLowerCase();
		return memories.filter((memory) => {
			return (
				query === "" ||
				memory.key.toLowerCase().includes(query) ||
				memory.value.toLowerCase().includes(query)
			);
		});
	}, [memories, search]);

	return {
		search,
		setSearch,
		sorting,
		setSorting,
		filteredMemories,
	};
};
