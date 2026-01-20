import { apiClient, ApiRequestConfig } from "../client";
import { TestCase, TestCaseResponse } from "@/types/TestСase";
import { PromptResponse } from "@/hooks/useRunPrompt";

// ============================================================================
// Types
// ============================================================================

export interface TestcasesListResponse {
	testcases: TestCase[];
}

export interface CreateTestcaseData {
	promptId: number;
	input: string;
	expectedOutput: string;
	lastOutput?: string;
	name?: string;
	memoryId?: number | null;
}

export interface UpdateTestcaseData {
	name?: string;
	input?: string;
	expectedOutput?: string;
	expectedChainOfThoughts?: string;
	memoryId?: number | null;
	[key: string]: any;
}

export interface RunTestcaseData {
	memoryId?: number;
	question?: string;
}

// ============================================================================
// Testcases API
// ============================================================================

export const testcasesApi = {
	/**
	 * Get all testcases for the current project
	 */
	getTestcases: async (config?: ApiRequestConfig): Promise<TestcasesListResponse> => {
		const response = await apiClient.get<TestcasesListResponse>("/testcases", config);
		return response.data;
	},

	/**
	 * Get a single testcase by ID
	 */
	getTestcase: async (
		testcaseId: number | string,
		config?: ApiRequestConfig,
	): Promise<TestCaseResponse> => {
		const response = await apiClient.get<TestCaseResponse>(`/testcases/${testcaseId}`, config);
		return response.data;
	},

	/**
	 * Create a new testcase
	 */
	createTestcase: async (
		data: CreateTestcaseData,
		config?: ApiRequestConfig,
	): Promise<{ testcase: TestCase }> => {
		const response = await apiClient.post<{ testcase: TestCase }>("/testcases", data, config);
		return response.data;
	},

	/**
	 * Update a testcase
	 */
	updateTestcase: async (
		testcaseId: number | string,
		data: UpdateTestcaseData,
		config?: ApiRequestConfig,
	): Promise<TestCaseResponse> => {
		const response = await apiClient.put<TestCaseResponse>(
			`/testcases/${testcaseId}`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Delete a testcase
	 */
	deleteTestcase: async (
		testcaseId: number | string,
		config?: ApiRequestConfig,
	): Promise<void> => {
		await apiClient.delete(`/testcases/${testcaseId}`, config);
	},

	/**
	 * Run a testcase
	 */
	runTestcase: async (
		testcaseId: number | string,
		data?: RunTestcaseData,
		config?: ApiRequestConfig,
	): Promise<TestCase> => {
		const response = await apiClient.post<TestCase>(
			`/testcases/${testcaseId}/run`,
			data,
			config,
		);
		return response.data;
	},
};
