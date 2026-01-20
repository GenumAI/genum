import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { MouseEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { promptApi } from "@/api/prompt";
import type { Memory } from "@/api/prompt/prompt.api";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { usePlaygroundActions, usePlaygroundTestcase } from "@/stores/playground.store";
import { toast } from "@/hooks/useToast";

export const useMemoryKey = (promptId: number) => {
	const { setSelectedMemoryId, setSelectedMemoryKeyName, setPersistedMemoryId } =
		usePlaygroundActions();
	const { selectedMemoryKeyName, persistedMemoryId } = usePlaygroundTestcase();

	const [selectedKey, setSelectedKey] = useState(persistedMemoryId || "");
	const [memoryValue, setMemoryValue] = useState("");
	const [createMemoryModalOpen, setCreateMemoryModalOpen] = useState(false);
	const [isManuallyCleared, setIsManuallyCleared] = useState(false);
	const [isOpenMemory, setIsOpenMemory] = useState(false);
	const originalValueRef = useRef("");
	const isUpdatingRef = useRef(false);
	const isInitializedRef = useRef(false);
	const selectedKeyRef = useRef(selectedKey);

	useEffect(() => {
		selectedKeyRef.current = selectedKey;
	}, [selectedKey]);

	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");

	const [memories, setMemories] = useState<Memory[]>([]);
	const [testcase, setTestcase] = useState<any>(null);
	const [isPending, setIsPending] = useState(false);

	const fetchMemories = useCallback(async () => {
		if (!promptId) return;
		try {
			const data = await promptApi.getMemories(promptId);
			setMemories(data.memories);
		} catch (error) {
			console.error("Failed to fetch memories", error);
		}
	}, [promptId]);

	const fetchTestcase = useCallback(async () => {
		if (!testcaseId) {
			setTestcase(null);
			return;
		}
		try {
			const data = await testcasesApi.getTestcase(testcaseId);
			setTestcase(data);
		} catch (error) {
			console.error("Failed to fetch testcase", error);
		}
	}, [testcaseId]);

	useEffect(() => {
		fetchMemories();
	}, [fetchMemories]);

	useEffect(() => {
		fetchTestcase();
	}, [fetchTestcase]);

	const prevPromptIdRef = useRef<number | undefined>(promptId);
	const prevTestcaseIdRef = useRef<string | null>(testcaseId);

	const syncSelection = useCallback(
		(memoryId: string, memoryKeyName = "") => {
			setSelectedMemoryId(memoryId);
			setPersistedMemoryId(memoryId);
			setSelectedMemoryKeyName(memoryKeyName);
		},
		[setSelectedMemoryId, setPersistedMemoryId, setSelectedMemoryKeyName],
	);

	// Reset when prompt changes
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

	// Reset when testcase changes
	useEffect(() => {
		const prevTestcaseId = prevTestcaseIdRef.current;
		const currentTestcaseId = testcaseId;

		if (prevTestcaseId !== currentTestcaseId) {
			isInitializedRef.current = false;
			setIsManuallyCleared(false);
		}

		prevTestcaseIdRef.current = currentTestcaseId;
	}, [testcaseId]);

	useEffect(() => {
		if (isUpdatingRef.current) {
			return;
		}

		if (!persistedMemoryId && selectedKey) {
			setSelectedKey("");
			setMemoryValue("");
			originalValueRef.current = "";
			return;
		}

		if (persistedMemoryId && persistedMemoryId !== selectedKey && !isManuallyCleared) {
			setSelectedKey(persistedMemoryId);
		}
	}, [persistedMemoryId, selectedKey, isManuallyCleared]);

	// Initialize and sync memory selection
	useEffect(() => {
		if (isUpdatingRef.current || memories.length === 0) {
			return;
		}

		if (testcaseId && !testcase) {
			return;
		}

		const testcaseMemoryId = testcase?.testcase?.memoryId;
		const memoryIdToLoad =
			persistedMemoryId || (testcaseMemoryId ? String(testcaseMemoryId) : "");
		const currentSelectedKey = selectedKeyRef.current;

		if (memoryIdToLoad && memoryIdToLoad !== currentSelectedKey && !isManuallyCleared) {
			const memory = memories.find((item) => String(item.id) === memoryIdToLoad);

			if (memory) {
				setSelectedKey(String(memory.id));
				setMemoryValue(memory.value);
				originalValueRef.current = memory.value;
				syncSelection(String(memory.id), memory.key);
			}
		} else if (!memoryIdToLoad && currentSelectedKey && !isManuallyCleared) {
			setSelectedKey("");
			setMemoryValue("");
			originalValueRef.current = "";
			syncSelection("", "");
		}

		if (!isInitializedRef.current) {
			isInitializedRef.current = true;
		}
	}, [memories, testcase, persistedMemoryId, testcaseId, isManuallyCleared, syncSelection]);

	// Update memory value when selectedKey changes
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
				setSelectedMemoryKeyName(memory.key);
			}
		} else if (persistedMemoryId) {
			const memory = memories.find((item) => item.id === Number(persistedMemoryId));
			if (!memory) {
				syncSelection("", "");
				return;
			}

			if (selectedMemoryKeyName !== memory.key) {
				setSelectedMemoryKeyName(memory.key);
			}
		}
	}, [
		memories,
		selectedKey,
		persistedMemoryId,
		selectedMemoryKeyName,
		setSelectedMemoryKeyName,
		syncSelection,
	]);

	const displayMemoryName = useMemo(() => {
		if (selectedMemoryKeyName) {
			return selectedMemoryKeyName;
		}

		if (persistedMemoryId && memories.length > 0) {
			const memory = memories.find((item) => item.id === Number(persistedMemoryId));
			return memory?.key || "";
		}

		return "";
	}, [selectedMemoryKeyName, persistedMemoryId, memories]);

	const updateMemory = async (_promptId: number, value: string) => {
		const memory = memories.find((item) => item.id === Number(selectedKey));
		if (memory) {
			try {
				await promptApi.updateMemory(promptId, memory.id, { value });
				originalValueRef.current = value;
				fetchMemories();
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
				await testcasesApi.updateTestcase(testcaseId, {
					memoryId: memory ? memory.id : null,
				});
				await Promise.all([fetchMemories(), fetchTestcase()]);
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
				await testcasesApi.updateTestcase(testcaseId, { memoryId: null });

				toast({
					title: "Memory cleared",
					description: "Memory selection has been reset",
				});

				await Promise.all([fetchMemories(), fetchTestcase()]);

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
		setIsPending(true);
		try {
			const response = await promptApi.createMemory(promptId, { key, value });
			setCreateMemoryModalOpen(false);
			setIsManuallyCleared(false);
			isUpdatingRef.current = true;

			const newMemoryId = response.memory?.id;
			if (!newMemoryId) {
				isUpdatingRef.current = false;
				return;
			}

			await fetchMemories();

			setSelectedKey(String(newMemoryId));
			setMemoryValue(value);
			originalValueRef.current = value;
			isInitializedRef.current = true;
			syncSelection(String(newMemoryId), key);

			if (testcaseId) {
				try {
					await testcasesApi.updateTestcase(testcaseId, {
						memoryId: newMemoryId,
					});
					await fetchTestcase();
				} catch {
					console.error("Failed to update testcase");
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
				title: "Something went wrong",
				variant: "destructive",
			});
		} finally {
			setIsPending(false);
		}
	};

	const selectedMemory = memories.find((item: Memory) => String(item.id) === selectedKey);
	const selectedKeyName = selectedMemory?.key || selectedMemoryKeyName;

	return {
		selectedKey,
		memoryValue,
		memories,
		isPending,
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
