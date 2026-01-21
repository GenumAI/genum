import { useState, useCallback } from "react";
import { useToast } from "@/hooks/useToast";
import { promptApi, type PromptResponse } from "@/api/prompt";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { formatTestcaseOutput } from "@/lib/formatTestcaseOutput";

export interface TokensInfo {
	prompt: number;
	completion: number;
	total: number;
}

export interface CostInfo {
	prompt: number;
	completion: number;
	total: number;
}

export type { PromptResponse };

export function useRunPrompt() {
	const [result, setResult] = useState<PromptResponse | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { toast } = useToast();

	const runPrompt = useCallback(
		async (
			promptId: number | string | undefined,
			payload?: { question?: string; memoryId?: number },
			testcaseId?: string | null,
		): Promise<PromptResponse | null> => {
			if (!promptId && !testcaseId) {
				return null;
			}

			setResult(null);
			setError(null);
			setIsLoading(true);

			try {
				if (testcaseId) {
					try {
						const testcase = await testcasesApi.runTestcase(testcaseId, payload);
						const formattedOutput = formatTestcaseOutput(testcase.lastOutput);
						setResult(formattedOutput);
						return formattedOutput;
					} catch (testcaseError: any) {
						throw testcaseError;
					}
				}

				if (!promptId) {
					setIsLoading(false);
					return null;
				}

				const data = await promptApi.runPrompt(promptId, payload);
				setResult(data);
				return data;
			} catch (err: any) {
				const errorMessage = err.message || "Unknown error";
				setError(errorMessage);

				toast({
					title: "Error",
					description: errorMessage,
					variant: "destructive",
					duration: 6000,
				});

				return null;
			} finally {
				setIsLoading(false);
			}
		},
		[toast],
	);

	return {
		runPrompt,
		result,
		loading: isLoading,
		error,
		setResult,
	};
}
