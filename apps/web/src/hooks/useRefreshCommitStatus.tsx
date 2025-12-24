import { useCallback } from "react";
import { promptApi } from "@/api/prompt";

export function useRefreshCommitStatus(
	promptId: number | undefined,
	onCommitStatusChange?: (c: boolean) => void,
) {
	return useCallback(async () => {
		if (!promptId) return false;
		try {
			const result = await promptApi.getPrompt(promptId);
			if (result?.prompt) {
				const commited = result.prompt.commited ?? false;
				onCommitStatusChange?.(commited);
				return commited;
			}
		} catch (err) {
			console.error("Failed to refresh commit status", err);
		}
		return false;
	}, [promptId, onCommitStatusChange]);
}
