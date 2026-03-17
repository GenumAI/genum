import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { testcaseKeys } from "@/query-keys/testcases.keys";
import type { TestCase } from "@/types/TestСase";

export const useHeaderTestcase = (
	testcaseId: string | null,
	promptId: number | undefined,
) => {
	const queryClient = useQueryClient();

	const testcaseQuery = useQuery({
		queryKey: testcaseKeys.byId(testcaseId ?? undefined),
		queryFn: async () => {
			if (!testcaseId) throw new Error("Testcase ID is required");
			return testcasesApi.getTestcase(testcaseId);
		},
		enabled: Boolean(testcaseId),
		retry: false,
	});

	const refreshTestcase = useCallback(async () => {
		if (!testcaseId) return null;
		try {
			return await queryClient.fetchQuery({
				queryKey: testcaseKeys.byId(testcaseId),
				queryFn: () => testcasesApi.getTestcase(testcaseId),
			});
		} catch (error) {
			console.error("Failed to refresh testcase:", error);
			return null;
		}
	}, [queryClient, testcaseId]);

	const renameTestcase = async (name: string) => {
		if (!testcaseId) return null;
		const updated = await testcasesApi.updateTestcase(testcaseId, { name });
		queryClient.setQueryData(testcaseKeys.byId(testcaseId), updated);
		const updatedTestcase = updated?.testcase;
		if (promptId && updatedTestcase) {
			queryClient.setQueryData(
				testcaseKeys.promptTestcases(promptId),
				(prev: TestCase[] | undefined) =>
					prev?.map((tc) => (tc.id === updatedTestcase.id ? updatedTestcase : tc)) ?? prev,
			);
		}
		return updated;
	};

	useEffect(() => {
		const handleTestcaseUpdated = () => {
			void refreshTestcase();
		};

		window.addEventListener("testcaseUpdated", handleTestcaseUpdated);
		return () => {
			window.removeEventListener("testcaseUpdated", handleTestcaseUpdated);
		};
	}, [refreshTestcase]);

	return {
		testcase: testcaseQuery.data?.testcase ?? null,
		isTestcaseLoading: testcaseQuery.isLoading,
		refreshTestcase,
		renameTestcase,
	};
};
