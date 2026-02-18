import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrgId, getProjectId } from "@/api/client";
import type { Prompt } from "@/pages/prompt/Prompts";
import { promptApi } from "@/api/prompt";

export function useProjectPrompts() {
	const orgId = getOrgId();
	const projectId = getProjectId();
	const queryClient = useQueryClient();

	const queryKey = ["prompts", orgId, projectId] as const;
	const query = useQuery({
		queryKey,
		queryFn: async () => {
			const data = await promptApi.getPrompts();
			return data.prompts ?? [];
		},
		enabled: !!orgId && !!projectId,
		refetchOnMount: "always",
	});

	const prompts = query.data ?? [];
	const loading = query.isLoading;
	const error = query.error ? "Failed to fetch prompts" : null;

	const removePromptLocally = (id: number) => {
		queryClient.setQueryData<Prompt[]>(queryKey, (prev) => {
			if (!prev) return prev;
			return prev.filter((p) => p.id !== id);
		});
	};

	const addPromptLocally = (prompt: Prompt) => {
		queryClient.setQueryData<Prompt[]>(queryKey, (prev) => {
			if (!prev) return [prompt];
			return [prompt, ...prev];
		});
	};

	const fetchPrompts = useCallback(async () => {
		await query.refetch();
	}, [query]);

	return {
		prompts,
		error,
		loading,
		removePromptLocally,
		addPromptLocally,
		refetch: fetchPrompts,
	};
}
