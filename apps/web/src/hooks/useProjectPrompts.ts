import { useParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import type { Prompt } from "@/pages/prompt/Prompts";
import { promptApi } from "@/api/prompt";

export function useProjectPrompts() {
	const { projectId } = useParams<{ projectId: string }>();
	const [prompts, setPrompts] = useState<Prompt[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchPrompts = useCallback(async () => {
		if (!projectId) return;
		setLoading(true);
		setError(null);
		try {
			const data = await promptApi.getPrompts();
			setPrompts(data.prompts);
		} catch (err: any) {
			setError(err.message || "Failed to fetch prompts");
		} finally {
			setLoading(false);
		}
	}, [projectId]);

	useEffect(() => {
		fetchPrompts();
	}, [fetchPrompts]);

	const removePromptLocally = (id: number) => {
		setPrompts((prev) => prev.filter((p) => p.id !== id));
	};

	const addPromptLocally = (prompt: Prompt) => {
		setPrompts((prev) => [prompt, ...prev]);
	};

	return {
		prompts,
		error,
		loading,
		removePromptLocally,
		addPromptLocally,
		refetch: fetchPrompts,
	};
}
