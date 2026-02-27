import { useQuery } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt/prompt.api";
import { testcaseKeys } from "@/query-keys/testcases.keys";

export const usePromptTestcases = (promptIdProp: string | number | undefined) => {
	const promptId = promptIdProp ? Number(promptIdProp) : undefined;
	return useQuery({
		queryKey: testcaseKeys.promptTestcases(promptId),
		queryFn: async () => {
			if (!promptId) return [];
			const response = await promptApi.getPromptTestcases(promptId);
			return response.testcases || [];
		},
		enabled: !!promptId,
	});
};
