import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { promptApi } from "@/api/prompt";
import type { BranchesResponse } from "../types";
import { versionKeys } from "@/query-keys/version.keys";
import { usePromptPlaceholders } from "@/pages/prompt/playground-tabs/placeholders/hooks/usePromptPlaceholders";

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

	// A commit carries its own placeholder snapshot, but "Current prompt" is the live
	// tables, which the prompt endpoint does not return. Without this the current side
	// would read as having no placeholders and the diff would announce that every one of
	// them had been deleted.
	const comparesCurrent = !commitA || commitA === "current" || commitB === "current";
	const livePlaceholdersQuery = usePromptPlaceholders(id, comparesCurrent);
	const liveDefinitions = useMemo(
		() =>
			(livePlaceholdersQuery.data ?? []).map((placeholder) => ({
				key: placeholder.key,
				values: placeholder.values.map((value) => ({
					name: value.name,
					content: value.content,
					isDefault: value.isDefault,
				})),
			})),
		[livePlaceholdersQuery.data],
	);

	// Held back until the live definitions have settled: handing the view a half-loaded
	// current side is how a diff claims a deletion that never happened.
	const liveReady =
		!comparesCurrent || (!livePlaceholdersQuery.isLoading && !livePlaceholdersQuery.isError);

	const withLivePlaceholders = <T>(data: T | undefined): T | null => {
		if (!data) return null;
		if (typeof data !== "object" || !("prompt" in data)) return data;
		const withPrompt = data as T & { prompt: Record<string, unknown> };
		return { ...withPrompt, prompt: { ...withPrompt.prompt, placeholders: liveDefinitions } };
	};

	const branchesRes = branchesQuery.data;
	const dataA = liveReady ? withLivePlaceholders(dataAQuery.data) : null;
	const dataB = liveReady ? withLivePlaceholders(dataBQuery.data) : null;
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
