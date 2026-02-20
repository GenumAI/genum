import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { organizationApi } from "@/api/organization";
import { projectApi } from "@/api/project";
import { organizationKeys } from "@/query-keys/organization.keys";

export interface OrgKey {
	id: number;
	name: string;
	publicKey: string;
	createdAt: string;
	lastUsed?: string;
	project: {
		id: number;
		name: string;
	};
	author: {
		id: number;
		name: string;
		email: string;
		picture?: string;
	};
}

interface UseOrgAPIKeysReturn {
	keys: OrgKey[];
	isLoading: boolean;
	isDeleting: boolean;
	deleteKey: (key: OrgKey) => Promise<void>;
	refresh: () => Promise<void>;
}

export function useOrgAPIKeys(): UseOrgAPIKeysReturn {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: organizationKeys.apiKeys(),
		queryFn: () => organizationApi.getProjectKeys(),
		refetchOnMount: "always",
	});

	const deleteMutation = useMutation({
		mutationFn: (keyId: number) => projectApi.deleteAPIKey(keyId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: organizationKeys.apiKeys() });
		},
	});

	const keys = (query.data?.keys ?? []) as OrgKey[];

	const deleteKey = async (key: OrgKey): Promise<void> => {
		try {
			await deleteMutation.mutateAsync(key.id);
			toast({ title: "Deleted", description: "Key removed" });
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Cannot delete key",
				variant: "destructive",
			});
			throw error;
		}
	};

	return {
		keys,
		isLoading: query.isLoading,
		isDeleting: deleteMutation.isPending,
		deleteKey,
		refresh: () => query.refetch().then(() => {}),
	};
}
