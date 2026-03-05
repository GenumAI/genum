import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { promptApi } from "@/api/prompt";
import type { Memory } from "@/api/prompt/prompt.api";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { toast } from "@/hooks/useToast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
	usePromptMemories,
	promptMemoriesQueryKey,
} from "@/pages/prompt/playground-tabs/memory/hooks/usePromptMemories";
import { useMemorySelection } from "@/pages/prompt/playground-tabs/memory/hooks/useMemorySelection";
import { testcaseKeys } from "@/query-keys/testcases.keys";
import usePlaygroundStore from "@/stores/playground.store";
import type { TestCase } from "@/types/TestСase";

export const useMemoryKey = (promptId: number) => {
	const queryClient = useQueryClient();
	const [createMemoryModalOpen, setCreateMemoryModalOpen] = useState(false);
	const [isOpenMemory, setIsOpenMemory] = useState(false);

	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");
	const { selection, setSelection } = useMemorySelection(promptId, testcaseId);
	const selectedMemoryId = selection.selectedMemoryId;
	const selectedMemoryKeyName = selection.selectedMemoryKeyName;

	const { data: memories = [] } = usePromptMemories(promptId);
	const { data: testcaseData } = useQuery({
		queryKey: testcaseKeys.byId(testcaseId ?? undefined),
		queryFn: () => testcasesApi.getTestcase(testcaseId as string),
		enabled: !!testcaseId,
	});

	const selectedKey = selectedMemoryId || "";
	const memoryValue = usePlaygroundStore((state) =>
		state.getMemoryValueDraft(promptId, testcaseId, selectedKey || null),
	);

	const setMemoryValue = useCallback(
		(value: string) => {
			usePlaygroundStore
				.getState()
				.setMemoryValueDraft(promptId, testcaseId, selectedKey || null, value);
		},
		[promptId, testcaseId, selectedKey],
	);

	const testcaseMemoryId = testcaseData?.testcase?.memoryId;

	const updateMemoryMutation = useMutation({
		mutationFn: ({ memoryId, value }: { memoryId: number; value: string }) =>
			promptApi.updateMemory(promptId, memoryId, { value }),
		onSuccess: (response) => {
			const updatedMemory = response?.memory;
			if (!updatedMemory) return;
			queryClient.setQueryData(
				promptMemoriesQueryKey(promptId),
				(prev: Memory[] | undefined) =>
					prev?.map((memory) => (memory.id === updatedMemory.id ? updatedMemory : memory)) ??
					prev,
			);
		},
		onError: () => {
			toast({
				title: "Something went wrong",
				variant: "destructive",
			});
		},
	});

	const createMemoryMutation = useMutation({
		mutationFn: ({ key, value }: { key: string; value: string }) =>
			promptApi.createMemory(promptId, { key, value }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: promptMemoriesQueryKey(promptId) });
		},
	});

	const updateTestcaseMutation = useMutation({
		mutationFn: ({ tcId, data }: { tcId: string; data: { memoryId: number | null } }) =>
			testcasesApi.updateTestcase(tcId, data),
		onSuccess: (data) => {
			const updatedTestcase = data?.testcase;
			if (!updatedTestcase) return;

			if (testcaseId) {
				queryClient.setQueryData(testcaseKeys.byId(testcaseId), { testcase: updatedTestcase });
			}
			queryClient.setQueryData(
				testcaseKeys.promptTestcases(promptId),
				(prev: TestCase[] | undefined) =>
					prev?.map((tc) => (tc.id === updatedTestcase.id ? updatedTestcase : tc)) ?? prev,
			);
		},
		onError: () => {
			toast({
				title: "Something went wrong",
				variant: "destructive",
			});
		},
	});

	// For testcase scope, keep selection synced with testcase memory from server.
	useEffect(() => {
		if (!testcaseId || testcaseData === undefined) return;
		const serverMemoryId = testcaseMemoryId ? String(testcaseMemoryId) : "";
		if (serverMemoryId === selectedMemoryId) return;

		const selectedMemory = memories.find((item) => String(item.id) === serverMemoryId);
		setSelection({
			selectedMemoryId: serverMemoryId,
			selectedMemoryKeyName: selectedMemory?.key || "",
		});
	}, [testcaseId, testcaseData, testcaseMemoryId, selectedMemoryId, memories, setSelection]);

	// Sync draft value from selected memory.
	useEffect(() => {
		if (!selectedKey) {
			setMemoryValue("");
			return;
		}
		const selectedMemory = memories.find((item) => String(item.id) === selectedKey);
		setMemoryValue(selectedMemory?.value || "");
	}, [selectedKey, memories, setMemoryValue]);

	const persistMemoryValue = useCallback(
		async (memoryId: string, value: string) => {
			const memory = memories.find((item) => item.id === Number(memoryId));
			if (!memory || memory.value === value) return true;
			return updateMemoryMutation
				.mutateAsync({ memoryId: memory.id, value })
				.then(() => true)
				.catch(() => false);
		},
		[memories, updateMemoryMutation],
	);

	const onValueChange = useCallback(
		(value: string) => {
			setMemoryValue(value);
		},
		[setMemoryValue],
	);

	const onBlurHandler = useCallback(() => {
		if (!selectedKey) return;
		void persistMemoryValue(selectedKey, memoryValue);
	}, [selectedKey, memoryValue, persistMemoryValue]);

	const onSelectKeyHandler = useCallback(
		async (key: string) => {
			const previousSelectedKey = selectedKey;
			const previousMemoryValue = memoryValue;

			const memory = key ? memories.find((item) => item.id === Number(key)) : undefined;
			const nextValue = memory?.value || "";

			// 1) local draft (zustand)
			setSelection({
				selectedMemoryId: key,
				selectedMemoryKeyName: memory?.key || "",
			});
			usePlaygroundStore
				.getState()
				.setMemoryValueDraft(promptId, testcaseId, key || null, nextValue);

			// 2) react-query -> 3) server
			if (previousSelectedKey) {
				await persistMemoryValue(previousSelectedKey, previousMemoryValue);
			}

			if (testcaseId) {
				await updateTestcaseMutation
					.mutateAsync({
						tcId: testcaseId,
						data: { memoryId: memory ? memory.id : null },
					})
					.catch(() => {});
			}
		},
		[
			selectedKey,
			memoryValue,
			memories,
			setSelection,
			promptId,
			testcaseId,
			persistMemoryValue,
			updateTestcaseMutation,
		],
	);

	const clearSelectedMemory = useCallback(
		async (e: MouseEvent<HTMLButtonElement>) => {
			e.stopPropagation();
			const previousSelectedKey = selectedKey;
			const previousMemoryValue = memoryValue;

			// 1) local draft (zustand)
			setSelection({ selectedMemoryId: "", selectedMemoryKeyName: "" });
			usePlaygroundStore.getState().setMemoryValueDraft(promptId, testcaseId, null, "");

			// 2) react-query -> 3) server
			if (previousSelectedKey) {
				await persistMemoryValue(previousSelectedKey, previousMemoryValue);
			}

			if (testcaseId) {
				const hasFailed = await updateTestcaseMutation
					.mutateAsync({
						tcId: testcaseId,
						data: { memoryId: null },
					})
					.then(() => false)
					.catch(() => true);
				if (hasFailed) return;
			}

			toast({
				title: "Memory cleared",
				description: "Memory selection has been reset",
			});
		},
		[
			selectedKey,
			memoryValue,
			setSelection,
			promptId,
			testcaseId,
			persistMemoryValue,
			updateTestcaseMutation,
		],
	);

	const createMemoryHandler = useCallback(
		async (key: string, value: string) => {
			try {
				const response = await createMemoryMutation.mutateAsync({ key, value });
				setCreateMemoryModalOpen(false);

				const newMemoryId = response.memory?.id;
				if (!newMemoryId) return;

				setSelection({
					selectedMemoryId: String(newMemoryId),
					selectedMemoryKeyName: key,
				});
				usePlaygroundStore
					.getState()
					.setMemoryValueDraft(promptId, testcaseId, String(newMemoryId), value);

				if (testcaseId) {
					await updateTestcaseMutation
						.mutateAsync({
							tcId: testcaseId,
							data: { memoryId: newMemoryId },
						})
						.catch(() => {});
				}

				toast({
					title: "Memory created",
					description: `Memory "${key}" has been created and selected`,
				});
			} catch {
				toast({
					title: "Failed to create memory",
					variant: "destructive",
				});
			}
		},
		[
			createMemoryMutation,
			setSelection,
			promptId,
			testcaseId,
			updateTestcaseMutation,
		],
	);

	const selectedMemory = memories.find((item: Memory) => String(item.id) === selectedKey);
	const selectedKeyName = selectedMemory?.key || selectedMemoryKeyName;

	const displayMemoryName = useMemo(() => {
		if (!selectedKey) return "";
		return selectedMemoryKeyName || selectedMemory?.key || "";
	}, [selectedKey, selectedMemoryKeyName, selectedMemory]);

	return {
		selectedKey,
		memoryValue,
		memories,
		isPending: createMemoryMutation.isPending,
		createMemoryModalOpen,
		setCreateMemoryModalOpen,
		isOpenMemory,
		setIsOpenMemory,
		displayMemoryName,
		selectedKeyName,
		onValueChange,
		onBlurHandler,
		onSelectKeyHandler,
		clearSelectedMemory,
		createMemoryHandler,
	};
};
