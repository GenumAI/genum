import { useQuery } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt/prompt.api";
import { calculateTestcaseStatusCounts } from "@/lib/testcaseUtils";
import { testcaseKeys } from "@/query-keys/testcases.keys";

export const useTestcaseStatusCounts = (promptIdProp?: number | string) => {
	const promptId = promptIdProp ? Number(promptIdProp) : undefined;
	const { data, isLoading, refetch } = useQuery({
		queryKey: testcaseKeys.promptTestcases(promptId),
		queryFn: async () => {
			if (!promptId) return [];
			const response = await promptApi.getPromptTestcases(promptId);
			return response.testcases || [];
		},
		enabled: !!promptId,
		select: (testcases) => calculateTestcaseStatusCounts(testcases),
	});

	return {
		data: data ?? { ok: 0, nok: 0, needRun: 0 },
		isLoading,
		refetch,
	};
};
