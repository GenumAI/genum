import { useCallback, useEffect, useRef, useState, useMemo } from "react";
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

export const useMemoryKey = (promptId: number) => {
	const queryClient = useQueryClient();
	const [memoryValue, setMemoryValue] = useState("");
	const [createMemoryModalOpen, setCreateMemoryModalOpen] = useState(false);
	const [isManuallyCleared, setIsManuallyCleared] = useState(false);
	const [isOpenMemory, setIsOpenMemory] = useState(false);
	const originalValueRef = useRef("");
	const isUpdatingRef = useRef(false);
	const isInitializedRef = useRef(false);

	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");
	const { selection, setSelection } = useMemorySelection(promptId, testcaseId);
	const selectedMemoryId = selection.selectedMemoryId;
	const selectedMemoryKeyName = selection.selectedMemoryKeyName;

	const [selectedKey, setSelectedKey] = useState(selectedMemoryId || "");
	const selectedKeyRef = useRef(selectedKey);

	useEffect(() => {
		selectedKeyRef.current = selectedKey;
	}, [selectedKey]);

	const { data: memories = [] } = usePromptMemories(promptId);

	const { data: testcaseData } = useQuery({
		queryKey: testcaseKeys.byId(testcaseId),
		queryFn: () => testcasesApi.getTestcase(testcaseId as string),
		enabled: !!testcaseId,
	});
	const testcase = testcaseData ?? null;

	const updateMemoryMutation = useMutation({
		mutationFn: ({ memoryId, value }: { memoryId: number; value: string }) =>
			promptApi.updateMemory(promptId, memoryId, { value }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: promptMemoriesQueryKey(promptId) });
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
		onSuccess: () => {
			if (testcaseId) {
				queryClient.invalidateQueries({ queryKey: testcaseKeys.byId(testcaseId) });
			}
			queryClient.invalidateQueries({ queryKey: promptMemoriesQueryKey(promptId) });
		},
	});

	const prevPromptIdRef = useRef<number | undefined>(promptId);
	const prevTestcaseIdRef = useRef<string | null>(testcaseId);

	const syncSelection = useCallback(
		(memoryId: string, memoryKeyName = "") => {
			setSelection({
				selectedMemoryId: memoryId,
				selectedMemoryKeyName: memoryKeyName,
			});
		},
		[setSelection],
	);

	useEffect(() => {
		const prevPromptId = prevPromptIdRef.current;
		const currentPromptId = promptId;

		if (prevPromptId !== undefined && prevPromptId !== currentPromptId) {
			setSelectedKey("");
			setMemoryValue("");
			originalValueRef.current = "";
			setIsManuallyCleared(false);
			isInitializedRef.current = false;
			syncSelection("", "");
		}

		prevPromptIdRef.current = currentPromptId;
	}, [promptId, syncSelection]);

	useEffect(() => {
		const prevTestcaseId = prevTestcaseIdRef.current;
		const currentTestcaseId = testcaseId;

		if (prevTestcaseId !== currentTestcaseId) {
			isInitializedRef.current = false;
			setIsManuallyCleared(false);

			if (prevTestcaseId && !currentTestcaseId) {
				isUpdatingRef.current = true;

				setSelectedKey("");
				setMemoryValue("");
				originalValueRef.current = "";
				selectedKeyRef.current = "";
				syncSelection("", "");

				queryClient.removeQueries({ queryKey: testcaseKeys.byId(prevTestcaseId) });

				setTimeout(() => {
					isUpdatingRef.current = false;
				}, 0);
			}
		}

		prevTestcaseIdRef.current = currentTestcaseId;
	}, [testcaseId, syncSelection, queryClient]);

	useEffect(() => {
		if (isUpdatingRef.current) {
			return;
		}

		if (!selectedMemoryId && selectedKey) {
			setSelectedKey("");
			setMemoryValue("");
			originalValueRef.current = "";
			return;
		}

		if (selectedMemoryId && selectedMemoryId !== selectedKey && !isManuallyCleared) {
			setSelectedKey(selectedMemoryId);
		}
	}, [selectedMemoryId, selectedKey, isManuallyCleared]);

	useEffect(() => {
		if (isUpdatingRef.current || memories.length === 0) {
			return;
		}

		if (testcaseId && !testcase) {
			return;
		}

		const testcaseMemoryId = testcase?.testcase?.memoryId;
		const memoryIdToLoad = testcaseMemoryId ? String(testcaseMemoryId) : "";
		const currentSelectedKey = selectedKeyRef.current;

		if (memoryIdToLoad && memoryIdToLoad !== currentSelectedKey && !isManuallyCleared) {
			const memory = memories.find((item) => String(item.id) === memoryIdToLoad);

			if (memory) {
				setSelectedKey(String(memory.id));
				setMemoryValue(memory.value);
				originalValueRef.current = memory.value;
				syncSelection(String(memory.id), memory.key);
			}
		} else if (
			!memoryIdToLoad &&
			currentSelectedKey &&
			!isManuallyCleared &&
			!testcaseId &&
			!selectedMemoryId
		) {
			setSelectedKey("");
			setMemoryValue("");
			originalValueRef.current = "";
			syncSelection("", "");
		}

		if (!isInitializedRef.current) {
			isInitializedRef.current = true;
		}
	}, [memories, testcase, testcaseId, isManuallyCleared, selectedMemoryId, syncSelection]);

	useEffect(() => {
		if (isUpdatingRef.current || !isInitializedRef.current) {
			return;
		}

		if (selectedKey && memories.length > 0) {
			const memory = memories.find((item) => item.id === Number(selectedKey));

			if (memory && memory.value !== originalValueRef.current) {
				setMemoryValue(memory.value);
				originalValueRef.current = memory.value;
			}
		}
	}, [selectedKey, memories]);

	useEffect(() => {
		if (memories.length === 0) {
			return;
		}

		if (selectedKey) {
			const memory = memories.find((item) => String(item.id) === selectedKey);
			if (!memory) {
				setSelectedKey("");
				setMemoryValue("");
				originalValueRef.current = "";
				setIsManuallyCleared(true);
				syncSelection("", "");
				return;
			}

			if (selectedMemoryKeyName !== memory.key) {
				syncSelection(selectedKey, memory.key);
			}
		}
	}, [memories, selectedKey, selectedMemoryKeyName, syncSelection]);

	const displayMemoryName = useMemo(() => {
		if (!testcaseId && !selectedKey) {
			return "";
		}

		if (selectedMemoryKeyName) {
			return selectedMemoryKeyName;
		}

		if (selectedKey && memories.length > 0) {
			const memory = memories.find((item) => item.id === Number(selectedKey));
			return memory?.key || "";
		}

		return "";
	}, [selectedMemoryKeyName, selectedKey, memories, testcaseId]);

	const updateMemory = async (_promptId: number, value: string) => {
		const memory = memories.find((item) => item.id === Number(selectedKey));
		if (memory) {
			try {
				await updateMemoryMutation.mutateAsync({ memoryId: memory.id, value });
				originalValueRef.current = value;
			} catch {
				toast({
					title: "Something went wrong",
					variant: "destructive",
				});
			}
		}
	};

	const onValueChange = (value: string) => {
		setMemoryValue(value);
	};

	const onBlurHandler = () => {
		if (promptId && selectedKey && memoryValue !== originalValueRef.current) {
			updateMemory(promptId, memoryValue);
		}
	};

	const onSelectKeyHandler = async (key: string) => {
		if (selectedKey && memoryValue !== originalValueRef.current) {
			await updateMemory(promptId, memoryValue);
		}

		setIsManuallyCleared(false);
		isUpdatingRef.current = true;

		const memory = key ? memories.find((item) => item.id === Number(key)) : undefined;

		if (key && memories.length > 0) {
			if (memory) {
				setMemoryValue(memory.value);
				originalValueRef.current = memory.value;
			} else {
				setMemoryValue("");
				originalValueRef.current = "";
			}
		} else {
			setMemoryValue("");
			originalValueRef.current = "";
		}

		setSelectedKey(key);
		syncSelection(key, memory?.key || "");

		if (testcaseId) {
			try {
				await updateTestcaseMutation.mutateAsync({
					tcId: testcaseId,
					data: { memoryId: memory ? memory.id : null },
				});
				setTimeout(() => {
					isUpdatingRef.current = false;
				}, 100);
			} catch {
				isUpdatingRef.current = false;
				toast({
					title: "Something went wrong",
					variant: "destructive",
				});
			}
		} else {
			isUpdatingRef.current = false;
		}
	};

	const clearSelectedMemory = async (e: MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();

		if (selectedKey && memoryValue !== originalValueRef.current) {
			await updateMemory(promptId, memoryValue);
		}

		setSelectedKey("");
		setMemoryValue("");
		originalValueRef.current = "";
		setIsManuallyCleared(true);
		isUpdatingRef.current = true;
		isInitializedRef.current = true;

		syncSelection("", "");

		if (testcaseId) {
			try {
				await updateTestcaseMutation.mutateAsync({
					tcId: testcaseId,
					data: { memoryId: null },
				});

				toast({
					title: "Memory cleared",
					description: "Memory selection has been reset",
				});

				setTimeout(() => {
					isUpdatingRef.current = false;
				}, 100);
			} catch {
				setIsManuallyCleared(false);
				isUpdatingRef.current = false;
				toast({
					title: "Something went wrong",
					variant: "destructive",
				});
			}
		} else {
			isUpdatingRef.current = false;
			toast({
				title: "Memory cleared",
				description: "Memory selection has been reset",
			});
		}
	};

	const createMemoryHandler = async (key: string, value: string) => {
		try {
			const response = await createMemoryMutation.mutateAsync({ key, value });
			setCreateMemoryModalOpen(false);
			setIsManuallyCleared(false);
			isUpdatingRef.current = true;

			const newMemoryId = response.memory?.id;
			if (!newMemoryId) {
				isUpdatingRef.current = false;
				return;
			}

			setSelectedKey(String(newMemoryId));
			setMemoryValue(value);
			originalValueRef.current = value;
			isInitializedRef.current = true;
			syncSelection(String(newMemoryId), key);

			if (testcaseId) {
				try {
					await updateTestcaseMutation.mutateAsync({
						tcId: testcaseId,
						data: { memoryId: newMemoryId },
					});
				} catch {
					toast({
						title: "Failed to update testcase",
						variant: "destructive",
					});
				}
			}

			setTimeout(() => {
				isUpdatingRef.current = false;
			}, 100);

			toast({
				title: "Memory created",
				description: `Memory "${key}" has been created and selected`,
			});
		} catch {
			isUpdatingRef.current = false;
			toast({
				title: "Failed to create memory",
				variant: "destructive",
			});
		}
	};

	const selectedMemory = memories.find((item: Memory) => String(item.id) === selectedKey);
	const selectedKeyName = selectedMemory?.key || selectedMemoryKeyName;

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
