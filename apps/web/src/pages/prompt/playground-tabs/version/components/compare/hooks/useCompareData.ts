import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { promptApi } from "@/api/prompt";
import type { BranchesResponse } from "../types";
import { versionKeys } from "@/query-keys/version.keys";

const UNKNOWN_AUTHOR = {
	id: 0,
	name: "Unknown",
	email: "",
	picture: "",
};

export const useCompareData = (id: string | undefined, commitA: string, commitB: string) => {
	const branchesQuery = useQuery({
		queryKey: versionKeys.compareBranches(id),
		queryFn: async () => {
			if (!id) throw new Error("No id");
			const result = await promptApi.getBranches(id);
			return {
				branches: result.branches.map((branch) => ({
					...branch,
					promptVersions: branch.promptVersions.map((version) => ({
						...version,
						author: version.author || UNKNOWN_AUTHOR,
					})),
				})),
			} as BranchesResponse;
		},
		enabled: Boolean(id),
	});

	const dataAQuery = useQuery({
		queryKey: versionKeys.compareVersionA(id, commitA),
		queryFn: async () => {
			if (!id) throw new Error("No id");
			if (!commitA || commitA === "current") {
				return promptApi.getPrompt(id);
			}
			return promptApi.getVersion(id, commitA);
		},
		enabled: Boolean(id),
	});

	const dataBQuery = useQuery({
		queryKey: versionKeys.compareVersionB(id, commitB),
		queryFn: async () => {
			if (!id || !commitB) throw new Error("Missing id or commitB");
			if (commitB === "current") {
				return promptApi.getPrompt(id);
			}
			return promptApi.getVersion(id, commitB);
		},
		enabled: Boolean(id && commitB),
	});

	const branchesRes = branchesQuery.data;
	const dataA = dataAQuery.data ?? null;
	const dataB = dataBQuery.data ?? null;
	const branchesLoading = branchesQuery.isLoading;
	const error = branchesQuery.isError ? "Failed to fetch branches" : null;

	const versions = useMemo(
		() =>
			branchesRes?.branches.flatMap((b) =>
				b.promptVersions.map((v) => ({ ...v, branchName: b.name })),
			) ?? [],
		[branchesRes],
	);

	const sortedVersions = useMemo(
		() =>
			[...versions].sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			),
		[versions],
	);

	return {
		dataA,
		dataB,
		branchesLoading,
		sortedVersions,
		versions,
		error,
	};
};
