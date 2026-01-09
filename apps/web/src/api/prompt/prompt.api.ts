import { apiClient, ApiRequestConfig } from "../client";
import { PromptSettings, TLanguageModel, TestcaseStatuses } from "@/types/Prompt";
import { TestCase } from "@/types/TestСase";

export interface PromptResponse {
	answer: string;
	tokens: {
		prompt: number;
		completion: number;
		total: number;
	};
	cost: {
		prompt: number;
		completion: number;
		total: number;
	};
	response_time_ms: number;
	status: string;
}

// ============================================================================
// Types
// ============================================================================

export interface Prompt {
	id: number;
	name: string;
	value: string;
	assertionType: string;
	updatedAt: string;
	createdAt: string;
	testcaseStatuses: TestcaseStatuses;
	commited?: boolean;
	memories: {
		length: number;
	};
	lastCommit: {
		commitHash: string;
		createdAt: string;
		author: {
			id: number;
			name: string;
			email: string;
			picture: string;
		};
	} | null;
	_count: {
		memories: number;
		testCases: number;
	};
}

export interface CreatePromptData {
	name: string;
	value: string;
}

export interface UpdatePromptData {
	name?: string;
	value?: string;
	assertionType?: string;
	assertionValue?: string;
	[key: string]: any;
}

export interface RunPromptData {
	question?: string;
	memoryId?: number;
}

export interface AuditResponse {
	audit: any;
}

export interface Memory {
	id: number;
	key: string;
	value: string;
	promptId?: number;
	updatedAt?: string;
	createdAt?: string;
}

export interface CreateMemoryData {
	key: string;
	value: string;
}

export interface UpdateMemoryData {
	value: string;
}

export interface Branch {
	id: number;
	promptId: number;
	name: string;
	createdAt: string;
	promptVersions: PromptVersion[];
}

export interface PromptVersion {
	id: number;
	commitMsg: string;
	commitHash: string;
	value: string;
	languageModelId: number;
	languageModelConfig: {
		tools?: any[];
		top_p?: number;
		max_tokens?: number;
		temperature?: number;
		response_format?: "json_object" | "text" | "json_schema";
		presence_penalty?: number;
		frequency_penalty?: number;
		reasoning_effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
		verbosity?: "low" | "medium" | "high";
		json_schema?: string | object;
	};
	audit?: any;
	createdAt: string;
	author?: {
		id: number;
		name: string;
		email: string;
		picture: string;
	};
	branch?: {
		name: string;
	};
	languageModel?: {
		id: number;
		name: string;
		vendor: string;
		description: string;
	};
}

export interface CommitData {
	commitMessage: string;
}

export interface GenerateCommitMessageResponse {
	message?: string;
}

export interface LogsQueryParams {
	page?: number;
	pageSize?: number;
	fromDate?: string;
	toDate?: string;
	logLevel?: string;
	model?: string;
	source?: string;
	query?: string;
}

export interface LogsResponse {
	logs: Log[];
	total: number;
}

export interface Log {
	log_lvl: string;
	timestamp: string;
	source: string;
	vendor: string;
	model: string;
	tokens_sum: number;
	cost: number;
	response_ms: number;
	description?: string;
	tokens_in?: number;
	tokens_out?: number;
	in?: string;
	out?: string;
	log_type?: string;
	user_name?: string;
	memory_key?: string;
	api?: string;
	prompt_id?: number;
}

export interface AgentMessageData {
	mode: string;
	query: string;
}

export interface SendMessageAgentResponse {
	response: any[] | any;
}

export interface GenerateInputData {
	query: string;
	systemPrompt: string;
}

export interface GenerateInputResponse {
	input: string;
}

export interface AssertionData {
	query: string;
}

export interface AssertionResponse {
	assertion?: string;
}

export interface ModelConfig {
	tools: any[];
	top_p?: number;
	max_tokens?: number;
	temperature?: number;
	response_format: "json_object" | "text" | "json_schema";
	presence_penalty?: number;
	frequency_penalty?: number;
	reasoning_effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
	verbosity?: "low" | "medium" | "high";
	languageModelId?: number;
	lastUpdated?: number;
	json_schema?: string | object;
}

export interface ModelConfigResponse {
	config: ModelConfig;
}

// ============================================================================
// Prompt API
// ============================================================================

export const promptApi = {
	/**
	 * Get all prompts for the current project
	 */
	getPrompts: async (config?: ApiRequestConfig): Promise<{ prompts: Prompt[] }> => {
		const response = await apiClient.get<{ prompts: Prompt[] }>("/prompts", config);
		return response.data;
	},

	/**
	 * Get a single prompt by ID
	 */
	getPrompt: async (
		promptId: number | string,
		config?: ApiRequestConfig,
	): Promise<{ prompt: PromptSettings }> => {
		const response = await apiClient.get<{ prompt: PromptSettings }>(
			`/prompts/${promptId}`,
			config,
		);
		return response.data;
	},

	/**
	 * Create a new prompt
	 */
	createPrompt: async (
		data: CreatePromptData,
		config?: ApiRequestConfig,
	): Promise<{ prompt: Prompt }> => {
		const response = await apiClient.post<{ prompt: Prompt }>("/prompts", data, config);
		return response.data;
	},

	/**
	 * Update a prompt
	 */
	updatePrompt: async (
		promptId: number | string,
		data: UpdatePromptData,
		config?: ApiRequestConfig,
	): Promise<{ prompt: PromptSettings }> => {
		const response = await apiClient.put<{ prompt: PromptSettings }>(
			`/prompts/${promptId}`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Delete a prompt
	 */
	deletePrompt: async (promptId: number | string, config?: ApiRequestConfig): Promise<void> => {
		await apiClient.delete(`/prompts/${promptId}`, config);
	},

	/**
	 * Run a prompt
	 */
	runPrompt: async (
		promptId: number | string,
		data?: RunPromptData,
		config?: ApiRequestConfig,
	): Promise<PromptResponse> => {
		const response = await apiClient.post<PromptResponse>(
			`/prompts/${promptId}/run`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Audit a prompt
	 */
	auditPrompt: async (
		promptId: number | string,
		config?: ApiRequestConfig,
	): Promise<AuditResponse> => {
		const response = await apiClient.post<AuditResponse>(
			`/prompts/${promptId}/audit`,
			{},
			config,
		);
		return response.data;
	},

	/**
	 * Get prompt testcases
	 */
	getPromptTestcases: async (
		promptId: number | string,
		config?: ApiRequestConfig,
	): Promise<{ testcases: TestCase[] }> => {
		const response = await apiClient.get<{ testcases: TestCase[] }>(
			`/prompts/${promptId}/testcases`,
			config,
		);
		return response.data;
	},

	// ============================================================================
	// Memories API
	// ============================================================================

	/**
	 * Get all memories for a prompt
	 */
	getMemories: async (
		promptId: number | string,
		config?: ApiRequestConfig,
	): Promise<{ memories: Memory[] }> => {
		const response = await apiClient.get<{ memories: Memory[] }>(
			`/prompts/${promptId}/memories`,
			config,
		);
		return response.data;
	},

	/**
	 * Create a new memory
	 */
	createMemory: async (
		promptId: number | string,
		data: CreateMemoryData,
		config?: ApiRequestConfig,
	): Promise<{ memory: Memory }> => {
		const response = await apiClient.post<{ memory: Memory }>(
			`/prompts/${promptId}/memories`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Update a memory
	 */
	updateMemory: async (
		promptId: number | string,
		memoryId: number | string,
		data: UpdateMemoryData,
		config?: ApiRequestConfig,
	): Promise<{ memory: Memory }> => {
		const response = await apiClient.put<{ memory: Memory }>(
			`/prompts/${promptId}/memories/${memoryId}`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Delete a memory
	 */
	deleteMemory: async (
		promptId: number | string,
		memoryId: number | string,
		config?: ApiRequestConfig,
	): Promise<void> => {
		await apiClient.delete(`/prompts/${promptId}/memories/${memoryId}`, config);
	},

	// ============================================================================
	// Versions & Commits API
	// ============================================================================

	/**
	 * Get all branches for a prompt
	 */
	getBranches: async (
		promptId: number | string,
		config?: ApiRequestConfig,
	): Promise<{ branches: Branch[] }> => {
		const response = await apiClient.get<{ branches: Branch[] }>(
			`/prompts/${promptId}/branches`,
			config,
		);
		return response.data;
	},

	/**
	 * Get a specific version/commit
	 */
	getVersion: async (
		promptId: number | string,
		versionId: number | string,
		config?: ApiRequestConfig,
	): Promise<{ version: PromptVersion & { prompt: PromptSettings } }> => {
		const response = await apiClient.get<{
			version: PromptVersion & { prompt: PromptSettings };
		}>(`/prompts/${promptId}/commit/${versionId}`, config);
		return response.data;
	},

	/**
	 * Commit a prompt
	 */
	commitPrompt: async (
		promptId: number | string,
		data: CommitData,
		config?: ApiRequestConfig,
	): Promise<{ commit: any }> => {
		const response = await apiClient.post<{ commit: any }>(
			`/prompts/${promptId}/commit`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Generate commit message
	 */
	generateCommitMessage: async (
		promptId: number | string,
		config?: ApiRequestConfig,
	): Promise<GenerateCommitMessageResponse> => {
		const response = await apiClient.get<GenerateCommitMessageResponse>(
			`/prompts/${promptId}/commit/generate`,
			config,
		);
		return response.data;
	},

	/**
	 * Rollback to a specific version
	 */
	rollbackVersion: async (
		promptId: number | string,
		versionId: number | string,
		config?: ApiRequestConfig,
	): Promise<{ prompt: PromptSettings }> => {
		const response = await apiClient.post<{ prompt: PromptSettings }>(
			`/prompts/${promptId}/commit/${versionId}/rollback`,
			{},
			config,
		);
		return response.data;
	},

	// ============================================================================
	// Logs API
	// ============================================================================

	/**
	 * Get logs for a prompt
	 */
	getLogs: async (
		promptId: number | string,
		params?: LogsQueryParams,
		config?: ApiRequestConfig,
	): Promise<LogsResponse> => {
		const queryParams = new URLSearchParams();
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					queryParams.append(key, String(value));
				}
			});
		}
		const queryString = queryParams.toString();
		const url = `/prompts/${promptId}/logs${queryString ? `?${queryString}` : ""}`;
		const response = await apiClient.get<LogsResponse>(url, config);
		return response.data;
	},

	// ============================================================================
	// Agent/Chat API
	// ============================================================================

	/**
	 * Get agent chat data
	 */
	getAgentChat: async (promptId: number | string, config?: ApiRequestConfig): Promise<any> => {
		const response = await apiClient.get(`/prompts/${promptId}/agent`, config);
		return response.data;
	},

	/**
	 * Send a message to the agent
	 */
	sendAgentMessage: async (
		promptId: number | string,
		data: AgentMessageData,
		config?: ApiRequestConfig,
	): Promise<SendMessageAgentResponse> => {
		const response = await apiClient.post<SendMessageAgentResponse>(
			`/prompts/${promptId}/agent/message`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Create a new agent chat
	 */
	createNewAgentChat: async (
		promptId: number | string,
		config?: ApiRequestConfig,
	): Promise<any> => {
		const response = await apiClient.post(`/prompts/${promptId}/agent/new-chat`, {}, config);
		return response.data;
	},

	// ============================================================================
	// Input Generation API
	// ============================================================================

	/**
	 * Generate input for a prompt
	 */
	generateInput: async (
		promptId: number | string,
		data: GenerateInputData,
		config?: ApiRequestConfig,
	): Promise<GenerateInputResponse> => {
		const response = await apiClient.post<GenerateInputResponse>(
			`/prompts/${promptId}/input`,
			data,
			config,
		);
		return response.data;
	},

	// ============================================================================
	// Assertion API
	// ============================================================================

	/**
	 * Generate assertion for a prompt
	 */
	generateAssertion: async (
		promptId: number | string,
		data: AssertionData,
		config?: ApiRequestConfig,
	): Promise<AssertionResponse> => {
		const response = await apiClient.post<AssertionResponse>(
			`/prompts/${promptId}/assertion`,
			data,
			config,
		);
		return response.data;
	},

	// ============================================================================
	// Model Configuration API
	// ============================================================================

	/**
	 * Update prompt model
	 */
	updatePromptModel: async (
		promptId: number | string,
		modelId: number | string,
		config?: ApiRequestConfig,
	): Promise<{ prompt: PromptSettings }> => {
		const response = await apiClient.patch<{ prompt: PromptSettings }>(
			`/prompts/${promptId}/model/${modelId}`,
			{},
			config,
		);
		return response.data;
	},

	/**
	 * Update model configuration/settings
	 */
	updateModelConfig: async (
		promptId: number | string,
		data: Partial<ModelConfig>,
		config?: ApiRequestConfig,
	): Promise<{ prompt: PromptSettings }> => {
		const response = await apiClient.put<{ prompt: PromptSettings }>(
			`/prompts/${promptId}/config`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Generate JSON schema for a prompt
	 */
	generateJsonSchema: async (
		promptId: number | string,
		data: { query?: string; jsonSchema?: any },
		config?: ApiRequestConfig,
	): Promise<{ jsonSchema: any }> => {
		const response = await apiClient.post<{ jsonSchema: any }>(
			`/prompts/${promptId}/json-schema`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Generate tool for a prompt
	 */
	generateTool: async (
		promptId: number | string,
		data: { query?: string; tool?: any },
		config?: ApiRequestConfig,
	): Promise<{ tool: any }> => {
		const response = await apiClient.post<{ tool: any }>(
			`/prompts/${promptId}/tool`,
			data,
			config,
		);
		return response.data;
	},

	// ============================================================================
	// Models API
	// ============================================================================

	/**
	 * Get all available models
	 */
	getModels: async (config?: ApiRequestConfig): Promise<{ models: TLanguageModel[] }> => {
		const response = await apiClient.get<{ models: TLanguageModel[] }>(
			"/prompts/models",
			config,
		);
		return response.data;
	},

	/**
	 * Get model configuration by ID
	 */
	getModelConfig: async (
		modelId: number | string,
		config?: ApiRequestConfig,
	): Promise<ModelConfigResponse> => {
		const response = await apiClient.get<ModelConfigResponse>(
			`/prompts/models/${modelId}`,
			config,
		);
		return response.data;
	},
};
