import { apiClient } from "../client";
import type { ApiRequestConfig } from "../client";

// ============================================================================
// Types
// ============================================================================

export interface PromptPlaceholderValue {
	id: number;
	name: string;
	content: string;
	isDefault: boolean;
	_count?: { testCases: number };
}

export interface PromptPlaceholder {
	id: number;
	key: string;
	description: string | null;
	values: PromptPlaceholderValue[];
}

export interface CreatePlaceholderData {
	key: string;
	description?: string | null;
}

export interface UpdatePlaceholderData {
	key?: string;
	description?: string | null;
}

export interface CreatePlaceholderValueData {
	name: string;
	content: string;
	isDefault?: boolean;
}

export interface UpdatePlaceholderValueData {
	name?: string;
	content?: string;
	isDefault?: boolean;
}

// ============================================================================
// Placeholders API
// ============================================================================

export const placeholderApi = {
	/**
	 * Get all placeholders for a prompt
	 */
	getPromptPlaceholders: async (
		promptId: number | string,
		config?: ApiRequestConfig,
	): Promise<{ placeholders: PromptPlaceholder[] }> => {
		const response = await apiClient.get<{ placeholders: PromptPlaceholder[] }>(
			`/prompts/${promptId}/placeholders`,
			config,
		);
		return response.data;
	},

	/**
	 * Create a new placeholder
	 */
	createPlaceholder: async (
		promptId: number | string,
		data: CreatePlaceholderData,
		config?: ApiRequestConfig,
	): Promise<{ placeholder: PromptPlaceholder }> => {
		const response = await apiClient.post<{ placeholder: PromptPlaceholder }>(
			`/prompts/${promptId}/placeholders`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Update a placeholder
	 */
	updatePlaceholder: async (
		promptId: number | string,
		placeholderId: number | string,
		data: UpdatePlaceholderData,
		config?: ApiRequestConfig,
		// `renamedOccurrences` is how many `{{key}}` holes the server rewrote in the
		// prompt draft. Zero on a plain description edit, and on a rename of a key the
		// author never wrote into the prompt.
	): Promise<{ placeholder: PromptPlaceholder; renamedOccurrences?: number }> => {
		const response = await apiClient.put<{
			placeholder: PromptPlaceholder;
			renamedOccurrences?: number;
		}>(`/prompts/${promptId}/placeholders/${placeholderId}`, data, config);
		return response.data;
	},

	/**
	 * Delete a placeholder
	 */
	deletePlaceholder: async (
		promptId: number | string,
		placeholderId: number | string,
		config?: ApiRequestConfig,
	): Promise<void> => {
		await apiClient.delete(`/prompts/${promptId}/placeholders/${placeholderId}`, config);
	},

	/**
	 * Create a new placeholder value
	 */
	createPlaceholderValue: async (
		promptId: number | string,
		placeholderId: number | string,
		data: CreatePlaceholderValueData,
		config?: ApiRequestConfig,
	): Promise<{ value: PromptPlaceholderValue }> => {
		const response = await apiClient.post<{ value: PromptPlaceholderValue }>(
			`/prompts/${promptId}/placeholders/${placeholderId}/values`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Update a placeholder value
	 */
	updatePlaceholderValue: async (
		promptId: number | string,
		placeholderId: number | string,
		valueId: number | string,
		data: UpdatePlaceholderValueData,
		config?: ApiRequestConfig,
	): Promise<{ value: PromptPlaceholderValue }> => {
		const response = await apiClient.put<{ value: PromptPlaceholderValue }>(
			`/prompts/${promptId}/placeholders/${placeholderId}/values/${valueId}`,
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Delete a placeholder value
	 */
	deletePlaceholderValue: async (
		promptId: number | string,
		placeholderId: number | string,
		valueId: number | string,
		config?: ApiRequestConfig,
	): Promise<void> => {
		await apiClient.delete(
			`/prompts/${promptId}/placeholders/${placeholderId}/values/${valueId}`,
			config,
		);
	},
};
