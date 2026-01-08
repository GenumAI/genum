import { useEffect } from "react";
import { usePromptsModels } from "@/hooks/usePromptsModels";
import type { Model } from "@/types/AIModel";

export function usePlaygroundModels() {
	const { models, getModels } = usePromptsModels();

	useEffect(() => {
		getModels();
	}, [getModels]);

	// Hook returns a slightly different Model type; normalize for SettingsBar expectations.
	return { models: models as unknown as Model[] };
}


