import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { placeholderApi } from "@/api/prompt/placeholder.api";
import type {
	CreatePlaceholderData,
	CreatePlaceholderValueData,
	PromptPlaceholder,
	UpdatePlaceholderData,
	UpdatePlaceholderValueData,
} from "@/api/prompt/placeholder.api";
import { getOrgId, getProjectId } from "@/api/client";
import { toast } from "@/hooks/useToast";
import { promptPlaceholdersQueryKey } from "@/pages/prompt/playground-tabs/placeholders/hooks/usePromptPlaceholders";
import { testcaseKeys } from "@/query-keys/testcases.keys";

function serverErrorMessage(error: unknown, fallback: string): string {
	if (isAxiosError(error)) {
		const data = error.response?.data as { error?: string } | undefined;
		if (data?.error) return data.error;
	}
	return fallback;
}

export function usePlaceholderMutations(promptId: number | undefined) {
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: promptPlaceholdersQueryKey(promptId) });
	// Both testcase list surfaces now read `placeholderValues` (Task 10 fix round 1),
	// so both need invalidating on a deletion that cascades pins: the per-prompt list
	// (mounted inside this same playground) and the project-wide list (not mounted
	// alongside this tab today, since it queries with `enabled: !promptId`, but
	// invalidating it here is correctness, not a bet on navigation timing).
	const invalidateTestcaseCaches = () => {
		queryClient.invalidateQueries({ queryKey: testcaseKeys.promptTestcases(promptId) });
		queryClient.invalidateQueries({ queryKey: testcaseKeys.list(getOrgId(), getProjectId()) });
	};

	const createPlaceholderMutation = useMutation({
		mutationFn: (data: CreatePlaceholderData) => {
			if (!promptId) throw new Error("No prompt id");
			return placeholderApi.createPlaceholder(promptId, data);
		},
		onSuccess: ({ placeholder }) => {
			// Seed the cache with the created placeholder synchronously, ahead of
			// `invalidate()`'s refetch. Without this, the caller's own follow-up
			// `setSelectedId(placeholder.id)` can render before the invalidated query
			// resolves; the selection-correcting effect then finds the id missing from
			// `filteredPlaceholders` and resets it to some other key.
			queryClient.setQueryData<PromptPlaceholder[]>(
				promptPlaceholdersQueryKey(promptId),
				(prev) => [...(prev ?? []), placeholder],
			);
			invalidate();
		},
		onError: (error) => {
			toast({
				title: serverErrorMessage(error, "Could not create placeholder"),
				variant: "destructive",
			});
		},
	});

	const updatePlaceholderMutation = useMutation({
		mutationFn: ({
			placeholderId,
			data,
		}: {
			placeholderId: number;
			data: UpdatePlaceholderData;
		}) => {
			if (!promptId) throw new Error("No prompt id");
			return placeholderApi.updatePlaceholder(promptId, placeholderId, data);
		},
		onSuccess: ({ placeholder }, { placeholderId }) => {
			// Seed key/description synchronously, ahead of `invalidate()`'s refetch --
			// createPlaceholder and updateValue both already do this for the same reason:
			// without it, the edited row in the list keeps showing the OLD key/description
			// until the refetch resolves. Only these two fields are merged in (not
			// `values`), since this response's values lack the `_count` the list's own
			// query includes -- overwriting wholesale would drop it until the refetch too.
			queryClient.setQueryData<PromptPlaceholder[]>(
				promptPlaceholdersQueryKey(promptId),
				(prev) =>
					prev?.map((existing) =>
						existing.id === placeholderId
							? {
									...existing,
									key: placeholder.key,
									description: placeholder.description,
								}
							: existing,
					),
			);
			invalidate();
		},
		onError: (error) => {
			toast({
				title: serverErrorMessage(error, "Could not update placeholder"),
				variant: "destructive",
			});
		},
	});

	const deletePlaceholderMutation = useMutation({
		mutationFn: (placeholderId: number) => {
			if (!promptId) throw new Error("No prompt id");
			return placeholderApi.deletePlaceholder(promptId, placeholderId);
		},
		onSuccess: () => {
			invalidate();
			// Deleting a placeholder cascades all of its values' TestCasePlaceholderValue
			// rows too -- the same staleness deleteValueMutation guards against below,
			// just for every value at once.
			invalidateTestcaseCaches();
		},
		onError: (error) => {
			toast({
				title: serverErrorMessage(error, "Could not delete placeholder"),
				variant: "destructive",
			});
		},
	});

	const createValueMutation = useMutation({
		mutationFn: ({
			placeholderId,
			data,
		}: {
			placeholderId: number;
			data: CreatePlaceholderValueData;
		}) => {
			if (!promptId) throw new Error("No prompt id");
			return placeholderApi.createPlaceholderValue(promptId, placeholderId, data);
		},
		onSuccess: () => invalidate(),
		onError: (error) => {
			toast({
				title: serverErrorMessage(error, "Could not create value"),
				variant: "destructive",
			});
		},
	});

	const updateValueMutation = useMutation({
		mutationFn: ({
			placeholderId,
			valueId,
			data,
		}: {
			placeholderId: number;
			valueId: number;
			data: UpdatePlaceholderValueData;
		}) => {
			if (!promptId) throw new Error("No prompt id");
			return placeholderApi.updatePlaceholderValue(promptId, placeholderId, valueId, data);
		},
		onSuccess: ({ value }, { placeholderId, valueId }) => {
			// Seed the cache with the saved value synchronously, ahead of
			// `invalidate()`'s refetch. Without this, a caller that clears its own
			// "unsaved draft" state right after this resolves (PlaceholderValueEditor's
			// blur-to-save) would briefly render the not-yet-refetched, pre-update
			// `value.content` from cache -- the exact stale-value flash this feature is
			// held to elsewhere.
			//
			// The server clears the previous default in the SAME transaction that sets
			// the new one, so the seed must too: leaving the outgoing default's
			// `isDefault: true` in cache until the refetch is what let two chips both
			// read as "default" in that window.
			queryClient.setQueryData<PromptPlaceholder[]>(
				promptPlaceholdersQueryKey(promptId),
				(prev) =>
					prev?.map((placeholder) =>
						placeholder.id === placeholderId
							? {
									...placeholder,
									values: placeholder.values.map((existing) => {
										if (existing.id === valueId) {
											return { ...existing, ...value };
										}
										return value.isDefault && existing.isDefault
											? { ...existing, isDefault: false }
											: existing;
									}),
								}
							: placeholder,
					),
			);
			invalidate();
		},
		onError: (error) => {
			toast({
				title: serverErrorMessage(error, "Could not update value"),
				variant: "destructive",
			});
		},
	});

	const deleteValueMutation = useMutation({
		mutationFn: ({ placeholderId, valueId }: { placeholderId: number; valueId: number }) => {
			if (!promptId) throw new Error("No prompt id");
			return placeholderApi.deletePlaceholderValue(promptId, placeholderId, valueId);
		},
		onSuccess: () => {
			invalidate();
			// Deleting a value cascades its TestCasePlaceholderValue rows on the server,
			// so the testcase list's cached `placeholderValues` (seeded by
			// GET /prompts/:id/testcases, and now GET /testcases too) now disagrees with
			// the database until this is invalidated -- it would otherwise keep showing
			// the deleted pin in the testcases table until something else happens to
			// refetch it.
			invalidateTestcaseCaches();
		},
		onError: (error) => {
			toast({
				title: serverErrorMessage(error, "Could not delete value"),
				variant: "destructive",
			});
		},
	});

	return {
		createPlaceholder: (data: CreatePlaceholderData) =>
			createPlaceholderMutation.mutateAsync(data),
		updatePlaceholder: (placeholderId: number, data: UpdatePlaceholderData) =>
			updatePlaceholderMutation.mutateAsync({ placeholderId, data }),
		deletePlaceholder: (placeholderId: number) =>
			deletePlaceholderMutation.mutateAsync(placeholderId),
		createValue: (placeholderId: number, data: CreatePlaceholderValueData) =>
			createValueMutation.mutateAsync({ placeholderId, data }),
		updateValue: (placeholderId: number, valueId: number, data: UpdatePlaceholderValueData) =>
			updateValueMutation.mutateAsync({ placeholderId, valueId, data }),
		deleteValue: (placeholderId: number, valueId: number) =>
			deleteValueMutation.mutateAsync({ placeholderId, valueId }),
		isCreatingPlaceholder: createPlaceholderMutation.isPending,
		isUpdatingPlaceholder: updatePlaceholderMutation.isPending,
		isDeletingPlaceholder: deletePlaceholderMutation.isPending,
		isMutatingValue:
			createValueMutation.isPending ||
			updateValueMutation.isPending ||
			deleteValueMutation.isPending,
	};
}
