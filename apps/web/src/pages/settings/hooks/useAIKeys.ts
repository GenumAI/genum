import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { organizationApi } from "@/api/organization";
import type { AIKey, Vendor } from "../utils/types";
import { organizationKeys } from "@/query-keys/organization.keys";

interface UseAIKeysReturn {
	// State
	keys: AIKey[];
	isLoading: boolean;
	quota: number | null;
	isLoadingQuota: boolean;

	// Actions
	fetchKeys: () => Promise<unknown>;
	fetchQuota: () => Promise<unknown>;
	createKey: (key: string, vendor: Vendor) => Promise<void>;
	deleteKey: (keyId: number) => Promise<void>;
}

export function useAIKeys(): UseAIKeysReturn {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const keysQuery = useQuery({
		queryKey: organizationKeys.aiKeys(),
		queryFn: () => organizationApi.getAIKeys(),
		refetchOnMount: "always",
	});

	const quotaQuery = useQuery({
		queryKey: organizationKeys.quota(),
		queryFn: () => organizationApi.getQuota(),
		refetchOnMount: "always",
	});

	const createKeyMutation = useMutation({
		mutationFn: ({ key, vendor }: { key: string; vendor: Vendor }) =>
			organizationApi.createAIKey({ key, vendor }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: organizationKeys.aiKeys() });
			queryClient.invalidateQueries({ queryKey: organizationKeys.quota() });
		},
	});

	const deleteKeyMutation = useMutation({
		mutationFn: (keyId: number) => organizationApi.deleteAIKey(keyId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: organizationKeys.aiKeys() });
			queryClient.invalidateQueries({ queryKey: organizationKeys.quota() });
		},
	});

	const keys = (keysQuery.data?.keys ?? []).filter(
		(k) => k.vendor !== "CUSTOM_OPENAI_COMPATIBLE",
	);
	const quota = quotaQuery.data?.quota?.balance ?? null;

	const createKey = async (key: string, vendor: Vendor): Promise<void> => {
		try {
			await createKeyMutation.mutateAsync({ key, vendor });
			toast({ title: "Success", description: "Key added" });
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Cannot add key",
				variant: "destructive",
			});
			throw error;
		}
	};

	const deleteKey = async (keyId: number): Promise<void> => {
		try {
			await deleteKeyMutation.mutateAsync(keyId);
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
		isLoading: keysQuery.isLoading,
		quota,
		isLoadingQuota: quotaQuery.isLoading,
		fetchKeys: keysQuery.refetch,
		fetchQuota: quotaQuery.refetch,
		createKey,
		deleteKey,
	};
}
