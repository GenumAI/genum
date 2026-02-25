import { useState, useEffect, useRef, useCallback } from "react";
import type { PromptResponse } from "@/hooks/useRunPrompt";
import { usePlaygroundContent, usePlaygroundActions } from "@/stores/playground.store";
import { compareValues } from "../utils/outputUtils";

interface UseExpectedOutputProps {
	onSaveAsExpected: (content: { answer: string }) => Promise<void>;
	testcaseId: string | null;
	promptId: number | undefined;
}

export const useExpectedOutput = ({
	onSaveAsExpected,
	testcaseId,
	promptId,
}: UseExpectedOutputProps) => {
	const { outputContent: content, expectedOutput: initialExpectedContent } =
		usePlaygroundContent();
	const { setExpectedOutput, clearOutput } = usePlaygroundActions();

	const [modifiedValue, setModifiedValue] = useState(initialExpectedContent?.answer || "");
	const [expectedMetrics, setExpectedMetrics] = useState<PromptResponse | undefined>(
		initialExpectedContent ?? undefined,
	);

	const prevPromptIdRef = useRef<number | undefined>(promptId);
	const prevTestcaseIdRef = useRef<string | null>(testcaseId);

	// Clear expected output when prompt changes
	useEffect(() => {
		const prevPromptId = prevPromptIdRef.current;
		const currentPromptId = promptId;

		if (prevPromptId !== undefined && prevPromptId !== currentPromptId) {
			if (!testcaseId) {
				setExpectedOutput(null);
				setModifiedValue("");
				setExpectedMetrics(undefined);
			}
		}

		prevPromptIdRef.current = currentPromptId;
	}, [promptId, testcaseId, setExpectedOutput]);

	// Sync with expected output coming from store/query source.
	useEffect(() => {
		if (initialExpectedContent?.answer) {
			setModifiedValue(initialExpectedContent.answer);
			setExpectedMetrics(initialExpectedContent ?? undefined);
		} else {
			setExpectedMetrics(undefined);
			if (testcaseId) {
				setModifiedValue("");
			}
		}
	}, [initialExpectedContent, testcaseId]);

	// Clear when testcase is deselected
	useEffect(() => {
		const prevTestcaseId = prevTestcaseIdRef.current;
		if (prevTestcaseId && !testcaseId) {
			setModifiedValue("");
			setExpectedMetrics(undefined);
			clearOutput();
		}
		prevTestcaseIdRef.current = testcaseId;
	}, [testcaseId, clearOutput]);

	const clearExpectedOutput = useCallback(() => {
		setModifiedValue("");
		setExpectedMetrics(undefined);
	}, []);

	const saveModifiedValue = useCallback(
		async (value: string) => {
			setModifiedValue(value);

			if (!testcaseId) {
				return;
			}
			if (compareValues(value, initialExpectedContent?.answer)) {
				return;
			}

			await onSaveAsExpected({
				answer: value,
			});
		},
		[testcaseId, initialExpectedContent, onSaveAsExpected],
	);

	const handleSaveAsExpected = useCallback(async () => {
		const lastOutputAnswer = content?.answer || "";

		const newExpectedContent = {
			answer: lastOutputAnswer,
		};

		setModifiedValue(lastOutputAnswer);
		setExpectedMetrics(content ?? undefined);

		try {
			await onSaveAsExpected(newExpectedContent);
			return { success: true };
		} catch (error) {
			setExpectedMetrics(initialExpectedContent ?? undefined);
			return { success: false, error };
		}
	}, [content, onSaveAsExpected, initialExpectedContent]);

	return {
		modifiedValue,
		expectedMetrics,
		clearExpectedOutput,
		saveModifiedValue,
		handleSaveAsExpected,
		hasValidOutput: !!content?.answer,
	};
};
