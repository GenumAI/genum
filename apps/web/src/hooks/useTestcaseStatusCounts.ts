import { useEffect } from "react";
import { usePlaygroundActions, usePlaygroundTestcase } from "@/stores/playground.store";

export const useTestcaseStatusCounts = (promptId?: number | string) => {
	const { fetchTestcases } = usePlaygroundActions();
	const { testcaseStatusCounts } = usePlaygroundTestcase();

	useEffect(() => {
		if (promptId) {
			fetchTestcases(promptId);
		}
	}, [promptId, fetchTestcases]);

	return {
		data: testcaseStatusCounts, // Return the counts directly
		refetch: () => promptId && fetchTestcases(promptId),
		isLoading: false, // Loading state can be added to store if needed, but for now we simplify
	};
};
