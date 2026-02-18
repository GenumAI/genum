import { apiClient } from "../client";
import type { ApiRequestConfig } from "../client";
import type { TestCase, TestCaseResponse } from "@/types/TestСase";

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
	files?: string[];
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
	files?: string[];
}

export interface RunTestcaseResponse {
	answer: string;
	tokens: {
		prompt: number;
		completion: number;
		total: number;
	};
	response_time_ms: number;
	cost: {
		prompt: number;
		completion: number;
		total: number;
	};
	testcase: TestCase;
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
	): Promise<RunTestcaseResponse> => {
		const response = await apiClient.post<RunTestcaseResponse>(
			`/testcases/${testcaseId}/run`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Add a file to a testcase
	 */
	addFileToTestcase: async (
		testcaseId: number | string,
		fileId: string,
		config?: ApiRequestConfig,
	): Promise<{ testcaseFile: any }> => {
		const response = await apiClient.post<{ testcaseFile: any }>(
			`/testcases/${testcaseId}/files`,
			{ fileId },
			config,
		);
		return response.data;
	},

	/**
	 * Remove a file from a testcase
	 */
	removeFileFromTestcase: async (
		testcaseId: number | string,
		fileId: string,
		config?: ApiRequestConfig,
	): Promise<void> => {
		await apiClient.delete(`/testcases/${testcaseId}/files/${fileId}`, config);
	},
};
