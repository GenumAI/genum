import { useState, useEffect, useCallback } from "react";
import { promptApi } from "@/api/prompt";
import type { Branch, BranchesResponse } from "../utils/types";

const SYSTEM_AUTHOR = {
	id: 0,
	name: "SYSTEM",
	email: "",
	picture: "",
};

export const useVersionsData = (id: string | undefined) => {
	const [data, setData] = useState<{ branches: Branch[] } | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isCommitted, setIsCommitted] = useState(false);

	const fetchBranches = useCallback(async () => {
		if (!id) return;
		setIsLoading(true);
		try {
			const result = await promptApi.getBranches(id);
			const transformed = {
				branches: result.branches.map((branch: any) => ({
					...branch,
					promptVersions: branch.promptVersions.map((version: any) => ({
						...version,
						author: version.author || SYSTEM_AUTHOR,
					})),
				})),
			} as BranchesResponse;
			setData(transformed);
		} catch (error) {
			console.error("Error fetching branches:", error);
		} finally {
			setIsLoading(false);
		}
	}, [id]);

	const fetchPrompt = useCallback(async () => {
		if (!id) return;
		try {
			const result = await promptApi.getPrompt(id);
			if (result?.prompt?.commited !== undefined) {
				setIsCommitted(result.prompt.commited);
			}
		} catch (error) {
			console.error("Error fetching prompt:", error);
		}
	}, [id]);

	const refresh = useCallback(() => {
		fetchBranches();
		fetchPrompt();
	}, [fetchBranches, fetchPrompt]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return {
		data,
		isLoading,
		isCommitted,
		setIsCommitted,
		refresh,
	};
};
