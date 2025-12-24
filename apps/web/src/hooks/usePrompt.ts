import { useState, useEffect, useCallback } from "react";
import type { PromptSettings } from "@/types/Prompt";
import { promptApi } from "@/api/prompt";

export type Options = { isWithoutUpdate: boolean };

type PromptResponse = {
	prompt: PromptSettings;
};

export function usePromptById(promptId: number | string | undefined) {
	const [data, setData] = useState<PromptResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchPrompt = useCallback(async () => {
		if (!promptId) return;
		setLoading(true);
		setError(null);
		try {
			const result = await promptApi.getPrompt(promptId);
			setData(result);
		} catch (err: any) {
			setError(err.message || "Failed to fetch prompt");
		} finally {
			setLoading(false);
		}
	}, [promptId]);

	useEffect(() => {
		fetchPrompt();
	}, [fetchPrompt]);

	const updatePromptName = async (updateData: Partial<PromptSettings>, _options?: Options) => {
		if (!promptId) return;

		setLoading(true);
		setError(null);
		try {
			const result = await promptApi.updatePrompt(promptId, updateData);
			if (result) {
				setData((oldData) => {
					if (!oldData) return result;
					return { ...oldData, prompt: result.prompt || result };
				});
			}
			return result;
		} catch (err: any) {
			setError(err.message || "Failed to update prompt");
			throw err;
		} finally {
			setLoading(false);
		}
	};

	return {
		prompt: data,
		loading,
		error,
		updatePromptName,
	};
}
