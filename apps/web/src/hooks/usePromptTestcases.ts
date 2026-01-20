import { useQuery } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt/prompt.api";

export const usePromptTestcases = (promptIdProp: string | number | undefined) => {
	const promptId = promptIdProp ? Number(promptIdProp) : undefined;
	return useQuery({
		queryKey: ["prompt-testcases", promptId],
		queryFn: async () => {
			if (!promptId) return [];
			const response = await promptApi.getPromptTestcases(promptId);
			return response.testcases || [];
		},
		enabled: !!promptId,
	});
};
