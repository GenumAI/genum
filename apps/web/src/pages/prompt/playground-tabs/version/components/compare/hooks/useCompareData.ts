import { useState, useEffect, useCallback, useMemo } from "react";
import { promptApi } from "@/api/prompt";
import type { BranchesResponse } from "../types";

export const useCompareData = (id: string | undefined, commitA: string, commitB: string) => {
	const [branchesRes, setBranchesRes] = useState<BranchesResponse | undefined>(undefined);
	const [branchesLoading, setBranchesLoading] = useState(false);
	const [dataA, setDataA] = useState<any>(null);
	const [dataB, setDataB] = useState<any>(null);
	const [error, setError] = useState<string | null>(null);

	const fetchBranches = useCallback(async () => {
		if (!id) return;
		setBranchesLoading(true);
		setError(null);
		try {
			const result = await promptApi.getBranches(id);
			const transformed: BranchesResponse = {
				branches: result.branches.map((branch: any) => ({
					...branch,
					promptVersions: branch.promptVersions.map((version: any) => ({
						...version,
						author: version.author || {
							id: 0,
							name: "Unknown",
							email: "",
							picture: "",
						},
					})),
				})),
			};
			setBranchesRes(transformed);
		} catch (err: unknown) {
			console.error("Failed to fetch branches", err);
			setError("Failed to fetch branches");
		} finally {
			setBranchesLoading(false);
		}
	}, [id]);

	const fetchDataA = useCallback(async () => {
		if (!id) return;
		try {
			let result: unknown;
			if (!commitA || commitA === "current") {
				result = await promptApi.getPrompt(id);
			} else {
				result = await promptApi.getVersion(id, commitA);
			}
			setDataA(result);
		} catch (err: unknown) {
			console.error("Failed to fetch dataA", err);
		}
	}, [id, commitA]);

	const fetchDataB = useCallback(async () => {
		if (!id || !commitB) return;
		try {
			let result: unknown;
			if (commitB === "current") {
				result = await promptApi.getPrompt(id);
			} else {
				result = await promptApi.getVersion(id, commitB);
			}
			setDataB(result);
		} catch (err: unknown) {
			console.error("Failed to fetch dataB", err);
		}
	}, [id, commitB]);

	useEffect(() => {
		fetchBranches();
	}, [fetchBranches]);

	useEffect(() => {
		fetchDataA();
	}, [fetchDataA]);

	useEffect(() => {
		fetchDataB();
	}, [fetchDataB]);

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
