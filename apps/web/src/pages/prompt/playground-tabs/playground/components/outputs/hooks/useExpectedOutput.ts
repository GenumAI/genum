/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from "react";
import type { PromptResponse } from "@/hooks/useRunPrompt";
import { usePlaygroundOutput } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundOutput";
import { compareValues } from "../utils/outputUtils";

interface UseExpectedOutputProps {
	onSaveAsExpected: (content: {
		answer: string;
		metrics?: Pick<PromptResponse, "tokens" | "cost" | "response_time_ms" | "status">;
	}) => Promise<void>;
	testcaseId: string | null;
	promptId: number | undefined;
}

export const useExpectedOutput = ({
	onSaveAsExpected,
	testcaseId,
	promptId,
}: UseExpectedOutputProps) => {
	const {
		outputContent: content,
		expectedOutput: initialExpectedContent,
		setExpectedOutput,
		clearOutput,
	} = usePlaygroundOutput({ promptId, testcaseId });

	const [modifiedValue, setModifiedValue] = useState(initialExpectedContent?.answer || "");
	const expectedMetrics = initialExpectedContent ?? undefined;

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
			}
		}

		prevPromptIdRef.current = currentPromptId;
	}, [promptId, testcaseId, setExpectedOutput]);

	// Sync with expected output coming from store/query source.
	useEffect(() => {
		if (initialExpectedContent?.answer) {
			setModifiedValue(initialExpectedContent.answer);
		} else {
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
			clearOutput();
		}
		prevTestcaseIdRef.current = testcaseId;
	}, [testcaseId, clearOutput]);

	const clearExpectedOutput = useCallback(() => {
		setModifiedValue("");
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
			metrics: content
				? {
						tokens: content.tokens,
						cost: content.cost,
						response_time_ms: content.response_time_ms,
						status: content.status,
					}
				: undefined,
		};

		setModifiedValue(lastOutputAnswer);
		setExpectedOutput(content ?? null);

		try {
			await onSaveAsExpected(newExpectedContent);
			return { success: true };
		} catch (error) {
			setExpectedOutput(initialExpectedContent ?? null);
			return { success: false, error };
		}
	}, [content, onSaveAsExpected, initialExpectedContent, setExpectedOutput]);

	return {
		modifiedValue,
		expectedMetrics,
		clearExpectedOutput,
		saveModifiedValue,
		handleSaveAsExpected,
		hasValidOutput: !!content?.answer,
	};
};
