import { useCallback, useState } from "react";
import type { ResponseModelConfig } from "@/types/AIModel";
import { promptApi } from "@/api/prompt";

// Define types for model and model configuration
interface Model {
	id: number;
	name: string;
	vendor: string;
	promptPrice: number;
	completionPrice: number;
	contextTokensMax: number;
	completionTokensMax: number;
	description: string;
	createdAt: string;
	updatedAt: string;
}

export function usePromptsModels() {
	const [models, setModels] = useState<Model[]>([]);
	const [modelConfig, setModelConfig] = useState<ResponseModelConfig | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const getModels = useCallback(async (): Promise<boolean> => {
		setLoading(true);
		setError(null);
		try {
			const result = await promptApi.getModels();
			if (result?.models) {
				setModels(result.models);
				return true;
			}
			return false;
		} catch (err: any) {
			console.error("❌ Fetch models error:", err);
			setError(err.message || "Failed to fetch models");
			return false;
		} finally {
			setLoading(false);
		}
	}, []);

	const getModelConfig = useCallback(async (id: number): Promise<ResponseModelConfig | null> => {
		setLoading(true);
		setError(null);
		try {
			const data = await promptApi.getModelConfig(id);
			setModelConfig(data.config);
			return data.config;
		} catch (err: any) {
			console.error("❌ Fetch model configuration error:", err);
			setError(err.message || "Failed to fetch model configuration");
			return null;
		} finally {
			setLoading(false);
		}
	}, []);

	const updatePromptModel = useCallback(
		async (promptId: number, modelId: number): Promise<boolean> => {
			if (!promptId || !modelId) return false;

			setLoading(true);
			setError(null);
			try {
				await promptApi.updatePromptModel(promptId, modelId);
				return true;
			} catch (err: any) {
				console.error("❌ Error updating prompt model:", err);
				setError(err.message || "Failed to update prompt model");
				return false;
			} finally {
				setLoading(false);
			}
		},
		[],
	);

	const updateModelSettings = useCallback(
		async (promptId: number, payload: Record<string, any>): Promise<boolean> => {
			if (!promptId) return false;

			setLoading(true);
			setError(null);
			try {
				await promptApi.updateModelConfig(promptId, payload);
				return true;
			} catch (err: any) {
				console.error("❌ Error updating model settings:", err);
				setError(err.message || "Failed to update model settings");
				return false;
			} finally {
				setLoading(false);
			}
		},
		[],
	);

	return {
		getModels,
		getModelConfig,
		updatePromptModel,
		updateModelSettings,
		models,
		modelConfig,
		loading,
		error,
	};
}
