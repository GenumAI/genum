import { apiClient, ApiRequestConfig } from "../client";

// ============================================================================
// Types
// ============================================================================

export interface UsageData {
	total_requests: number;
	total_tokens_sum: number;
	total_cost: number;
	average_response_ms: number;
	prompts: any[];
	models: any[];
	users: any[];
	promptNames: { id: number; name: string }[];
}

export interface LogsQueryParams {
	page?: number;
	pageSize?: number;
	fromDate?: string;
	toDate?: string;
	logLevel?: string;
	model?: string;
	source?: string;
	promptId?: number | string;
	query?: string;
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

export interface LogsResponse {
	logs: Log[];
	total: number;
}

export interface ProjectAPIKey {
	id: string | number;
	name: string;
	publicKey: string;
	createdAt: string;
	lastUsed?: string;
	author: {
		id: number;
		name: string;
		email: string;
		picture?: string;
		avatar?: string;
	};
}

export interface CreateAPIKeyData {
	name: string;
}

export interface CreateAPIKeyResponse {
	apiKey: {
		key: string;
	};
}

export interface ProjectMember {
	id: number;
	organizationId?: number;
	userId?: number;
	projectId?: number;
	role: string;
	user: {
		id: number;
		email: string;
		name: string;
		picture?: string;
	};
}

export interface AddMemberData {
	userId: number;
	role: string;
}

export interface UpdateMemberRoleData {
	role: string;
}

export interface Project {
	id: number;
	name: string;
	description: string;
	initial: boolean;
	organizationId: number;
	createdAt?: string;
	author?: {
		name: string;
		email: string;
	};
}

export interface UpdateProjectData {
	name: string;
	description: string;
}

// ============================================================================
// Project API
// ============================================================================

export const projectApi = {
	// ============================================================================
	// Project Details API
	// ============================================================================

	/**
	 * Get project details
	 */
	getProject: async (config?: ApiRequestConfig): Promise<{ project: Project }> => {
		const response = await apiClient.get<{ project: Project }>("/project", config);
		return response.data;
	},

	/**
	 * Update project details
	 */
	updateProject: async (
		data: UpdateProjectData,
		config?: ApiRequestConfig,
	): Promise<{ project: Project }> => {
		const response = await apiClient.put<{ project: Project }>("/project", data, config);
		return response.data;
	},

	// ============================================================================
	// Usage API
	// ============================================================================

	/**
	 * Get project usage statistics
	 */
	getUsage: async (
		fromDate: string,
		toDate: string,
		config?: ApiRequestConfig,
	): Promise<UsageData> => {
		const response = await apiClient.get<UsageData>(
			`/project/usage_v2?fromDate=${fromDate}&toDate=${toDate}`,
			config,
		);
		return response.data;
	},

	// ============================================================================
	// Logs API
	// ============================================================================

	/**
	 * Get project logs
	 */
	getLogs: async (params?: LogsQueryParams, config?: ApiRequestConfig): Promise<LogsResponse> => {
		const queryParams = new URLSearchParams();
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					queryParams.append(key, String(value));
				}
			});
		}
		const queryString = queryParams.toString();
		const url = `/project/logs${queryString ? `?${queryString}` : ""}`;
		const response = await apiClient.get<LogsResponse>(url, config);
		return response.data;
	},

	// ============================================================================
	// API Keys API
	// ============================================================================

	/**
	 * Get all API keys for the project
	 */
	getAPIKeys: async (config?: ApiRequestConfig): Promise<{ apiKeys: ProjectAPIKey[] }> => {
		const response = await apiClient.get<{ apiKeys: ProjectAPIKey[] }>(
			"/project/api-keys",
			config,
		);
		return response.data;
	},

	/**
	 * Create a new API key
	 */
	createAPIKey: async (
		data: CreateAPIKeyData,
		config?: ApiRequestConfig,
	): Promise<CreateAPIKeyResponse> => {
		const response = await apiClient.post<CreateAPIKeyResponse>(
			"/project/api-keys",
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Delete an API key
	 */
	deleteAPIKey: async (keyId: number | string, config?: ApiRequestConfig): Promise<void> => {
		await apiClient.delete(`/project/api-keys/${keyId}`, config);
	},

	// ============================================================================
	// Members API
	// ============================================================================

	/**
	 * Get all members of the project
	 */
	getMembers: async (config?: ApiRequestConfig): Promise<{ members: ProjectMember[] }> => {
		const response = await apiClient.get<{ members: ProjectMember[] }>(
			"/project/members",
			config,
		);
		return response.data;
	},

	/**
	 * Add a member to the project
	 */
	addMember: async (data: AddMemberData, config?: ApiRequestConfig): Promise<void> => {
		await apiClient.post("/project/members", data, config);
	},

	/**
	 * Update a member's role
	 */
	updateMemberRole: async (
		memberId: number | string,
		data: UpdateMemberRoleData,
		config?: ApiRequestConfig,
	): Promise<void> => {
		await apiClient.put(`/project/members/${memberId}/role`, data, config);
	},

	/**
	 * Remove a member from the project
	 */
	deleteMember: async (memberId: number | string, config?: ApiRequestConfig): Promise<void> => {
		await apiClient.delete(`/project/members/${memberId}`, config);
	},
};
