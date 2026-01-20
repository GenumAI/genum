import { useQuery } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt/prompt.api";
import { calculateTestcaseStatusCounts } from "@/lib/testcaseUtils";

export const useTestcaseStatusCounts = (promptIdProp?: number | string) => {
	const promptId = promptIdProp ? Number(promptIdProp) : undefined;
	const { data, isLoading, refetch } = useQuery({
		queryKey: ["testcase-status-counts", promptId],
		queryFn: async () => {
			if (!promptId) return { ok: 0, nok: 0, needRun: 0 };
			const response = await promptApi.getPromptTestcases(promptId);
			return calculateTestcaseStatusCounts(response.testcases);
		},
		enabled: !!promptId,
	});

	return {
		data: data ?? { ok: 0, nok: 0, needRun: 0 },
		isLoading,
		refetch,
	};
};
