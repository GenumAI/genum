import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrgId, getProjectId } from "@/api/client";
import { promptApi } from "@/api/prompt";
import type { Prompt } from "@/api/prompt";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { testcaseKeys } from "@/query-keys/testcases.keys";
import { promptKeys } from "@/query-keys/prompt.keys";
import type { TestCase } from "@/types/TestСase";

export interface ChartDataItem {
	name: string;
	passed: number;
	failed: number;
	needRun: number;
	prompt_id: number;
}

export interface PromptStats {
	prompt_id: number;
	total_requests: number;
	total_tokens_in: number;
	total_tokens_out: number;
	average_response_ms: number;
	total_cost: number;
	error_rate: number;
	last_used: string;
}

const useTestcasesGroupedByPrompt = (filteredPrompts?: PromptStats[]) => {
	const organizationId = getOrgId();
	const projectId = getProjectId();

	const {
		data: testcasesData,
		isLoading: testcasesLoading,
		error: testcasesError,
		refetch: refetchTestcases,
	} = useQuery<TestCase[]>({
		queryKey: testcaseKeys.list(organizationId, projectId),
		enabled: !!organizationId && !!projectId,
		queryFn: async () => {
			const response = await testcasesApi.getTestcases();
			return response.testcases ?? [];
		},
	});

	const {
		data: promptsData,
		isLoading: promptsLoading,
		error: promptsError,
		refetch: refetchPrompts,
	} = useQuery<Prompt[]>({
		queryKey: promptKeys.list(organizationId, projectId),
		enabled: !!organizationId && !!projectId,
		queryFn: async () => {
			const response = await promptApi.getPrompts();
			return response.prompts ?? [];
		},
	});

	const processedData = useMemo(() => {
		if (!Array.isArray(testcasesData) || !Array.isArray(promptsData)) {
			return [];
		}

		const allowedPromptIds = filteredPrompts
			? new Set(filteredPrompts.map((p) => p.prompt_id))
			: null;

		const promptNamesMap = promptsData.reduce(
			(acc: Record<number, string>, prompt: Prompt) => {
				acc[prompt.id] = prompt.name;
				return acc;
			},
			{},
		);

		const groupedByPrompt = testcasesData.reduce(
			(acc: Record<number, ChartDataItem>, testcase: TestCase) => {
				const promptId = testcase.promptId;

				if (allowedPromptIds && !allowedPromptIds.has(promptId)) {
					return acc;
				}

				const promptName = promptNamesMap[promptId] || `Prompt ${promptId}`;

				if (!acc[promptId]) {
					acc[promptId] = {
						name: promptName,
						passed: 0,
						failed: 0,
						needRun: 0,
						prompt_id: promptId,
					};
				}

				if (testcase.status === "OK") {
					acc[promptId].passed++;
				} else if (testcase.status === "NOK") {
					acc[promptId].failed++;
				} else if (testcase.status === "NEED_RUN") {
					acc[promptId].needRun++;
				}

				return acc;
			},
			{},
		);

		return Object.values(groupedByPrompt).sort(
			(a: ChartDataItem, b: ChartDataItem) =>
				b.passed + b.failed + b.needRun - (a.passed + a.failed + a.needRun),
		);
	}, [testcasesData, promptsData, filteredPrompts]);

	const refetch = useCallback(async () => {
		await Promise.all([refetchTestcases(), refetchPrompts()]);
	}, [refetchPrompts, refetchTestcases]);

	return {
		chartData: processedData,
		isLoading: testcasesLoading || promptsLoading,
		error: testcasesError || promptsError,
		refetch,
	};
};

export default useTestcasesGroupedByPrompt;
