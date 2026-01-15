import { useMemo, useState, useCallback } from "react";
import type { PromptSettings } from "@/types/Prompt";
import type { Model } from "@/types/AIModel";

export function useSettingsBar(prompt?: PromptSettings, models?: Model[]) {
	const [isOpenModels, setIsOpenModels] = useState(true);
	const [isModelValid, setIsModelValid] = useState(true);

	const promptId = prompt?.id;
	const isLoading = !prompt || !promptId;

	// Filter valid models
	const validModels = useMemo(() => {
		if (!models || !Array.isArray(models)) {
			return [];
		}
		return models.filter(
			(model) =>
				model &&
				typeof model === "object" &&
				model.id &&
				model.name &&
				typeof model.name === "string",
		);
	}, [models]);

	const toggleModels = useCallback(() => {
		setIsOpenModels((prev) => !prev);
	}, []);

	return {
		promptId,
		isLoading,
		isOpenModels,
		isModelValid,
		validModels,
		setIsModelValid,
		toggleModels,
	};
}
