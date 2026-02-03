import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/useToast";
import { organizationApi } from "@/api/organization";
import type { CustomProvider, CustomProviderDeleteStatus } from "@/api/organization";

interface UseCustomProviderReturn {
	provider: CustomProvider | null;
	isLoading: boolean;
	isSyncing: boolean;
	deleteStatus: CustomProviderDeleteStatus | null;
	deleteStatusError: string | null;
	isCheckingDeleteStatus: boolean;

	fetchProvider: () => Promise<void>;
	syncModels: () => Promise<void>;
	deleteProvider: () => Promise<void>;
	checkDeleteStatus: () => Promise<void>;
}

export function useCustomProvider(): UseCustomProviderReturn {
	const { toast } = useToast();

	const [provider, setProvider] = useState<CustomProvider | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isSyncing, setIsSyncing] = useState(false);
	const [deleteStatus, setDeleteStatus] = useState<CustomProviderDeleteStatus | null>(null);
	const [deleteStatusError, setDeleteStatusError] = useState<string | null>(null);
	const [isCheckingDeleteStatus, setIsCheckingDeleteStatus] = useState(false);

	const fetchProvider = useCallback(async () => {
		try {
			setIsLoading(true);
			const data = await organizationApi.getCustomProvider();
			setProvider(data?.provider ?? null);
		} catch (error) {
			console.error(error);
			setProvider(null);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const syncModels = useCallback(async () => {
		if (isSyncing) return;

		try {
			setIsSyncing(true);
			const result = await organizationApi.syncProviderModels();

			toast({
				title: "Synced",
				description: `${result.created} new, ${result.existing} existing${result.removed > 0 ? `, ${result.removed} removed` : ""}`,
			});

			await fetchProvider();
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: error instanceof Error ? error.message : "Failed to sync models",
				variant: "destructive",
			});
		} finally {
			setIsSyncing(false);
		}
	}, [isSyncing, toast, fetchProvider]);

	const checkDeleteStatus = useCallback(async () => {
		try {
			setIsCheckingDeleteStatus(true);
			setDeleteStatusError(null);
			const status = await organizationApi.getCustomProviderDeleteStatus();
			setDeleteStatus(status);
		} catch (error) {
			console.error(error);
			setDeleteStatus(null);
			setDeleteStatusError("Failed to check if the provider can be deleted.");
		} finally {
			setIsCheckingDeleteStatus(false);
		}
	}, []);

	const deleteProvider = useCallback(async () => {
		if (isCheckingDeleteStatus) {
			throw new Error("Still checking delete status");
		}

		if (deleteStatusError) {
			throw new Error(deleteStatusError);
		}

		if (deleteStatus && !deleteStatus.canDelete) {
			throw new Error("This provider is still in use by prompts or productive commits.");
		}

		try {
			await organizationApi.deleteCustomProvider();
			toast({ title: "Deleted", description: "Custom provider removed" });
			setProvider(null);
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Cannot delete provider",
				variant: "destructive",
			});
			await checkDeleteStatus();
			throw error;
		}
	}, [isCheckingDeleteStatus, deleteStatusError, deleteStatus, toast, checkDeleteStatus]);

	useEffect(() => {
		fetchProvider();
	}, [fetchProvider]);

	return {
		provider,
		isLoading,
		isSyncing,
		deleteStatus,
		deleteStatusError,
		isCheckingDeleteStatus,
		fetchProvider,
		syncModels,
		deleteProvider,
		checkDeleteStatus,
	};
}
