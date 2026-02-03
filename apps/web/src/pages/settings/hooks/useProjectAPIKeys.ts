import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { projectApi } from "@/api/project";
import type { ProjectAPIKey } from "@/api/project";
import type { NewKeyResponse } from "../utils/types";
import { getOrgId, getProjectId } from "@/api/client";

export const PROJECT_API_KEYS_QUERY_KEY = ["project", "apiKeys"] as const;

export function useProjectAPIKeys() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const orgId = getOrgId();
	const projectId = getProjectId();	

	const [isCreating, setIsCreating] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [newKeyResponse, setNewKeyResponse] = useState<NewKeyResponse | null>(null);

	const query = useQuery({
		queryKey: [...PROJECT_API_KEYS_QUERY_KEY, orgId, projectId],
		queryFn: () => projectApi.getAPIKeys(),
		enabled: Boolean(orgId && projectId),
		refetchOnMount: "always",
	});

	const createMutation = useMutation({
		mutationFn: (name: string) => projectApi.createAPIKey({ name: name.trim() }),
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: [...PROJECT_API_KEYS_QUERY_KEY, orgId, projectId],
			});
			setNewKeyResponse({ key: data.apiKey.key });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (keyId: string | number) => projectApi.deleteAPIKey(keyId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: [...PROJECT_API_KEYS_QUERY_KEY, orgId, projectId],
			});
		},
	});

	const apiKeys = (query.data?.apiKeys ?? []) as ProjectAPIKey[];

	const createAPIKey = useCallback(
		async (name: string) => {
			if (!name.trim()) return false;
			try {
				setIsCreating(true);
				await createMutation.mutateAsync(name.trim());
				toast({
					title: "Success",
					description: "API key created successfully",
					duration: 3000,
				});
				return true;
			} catch (error) {
				console.error("Error creating API key:", error);
				toast({
					title: "Error",
					description: "Failed to create API key",
					variant: "destructive",
					duration: 3000,
				});
				return false;
			} finally {
				setIsCreating(false);
			}
		},
		[createMutation, toast],
	);

	const deleteAPIKey = useCallback(
		async (keyId: string | number) => {
			try {
				setDeletingId(Number(keyId));
				await deleteMutation.mutateAsync(keyId);
				toast({
					title: "Success",
					description: "API key deleted successfully",
					duration: 3000,
				});
			} catch (error) {
				console.error("Error deleting API key:", error);
				toast({
					title: "Error",
					description: "Failed to delete API key",
					variant: "destructive",
					duration: 3000,
				});
			} finally {
				setDeletingId(null);
			}
		},
		[deleteMutation, toast],
	);

	const clearNewKeyResponse = useCallback(() => {
		setNewKeyResponse(null);
	}, []);

	return {
		apiKeys,
		isLoading: query.isLoading,
		isCreating,
		deletingId,
		newKeyResponse,
		createAPIKey,
		deleteAPIKey,
		clearNewKeyResponse,
		refresh: query.refetch,
	};
}
