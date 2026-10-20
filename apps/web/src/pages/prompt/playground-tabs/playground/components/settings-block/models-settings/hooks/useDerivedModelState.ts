import { useMemo } from "react";
import type { PromptSettings } from "@/types/Prompt";
import type { Model, ResponseModelConfig } from "@/types/AIModel";
import { isRetired } from "@/lib/modelLifecycle";
import { groupModelsByVendor } from "../utils/helpers";

interface UseDerivedModelStateProps {
	prompt?: PromptSettings;
	models?: Model[];
	selectedModelName: string;
	selectedModelId: number | null;
	activeModelConfig: ResponseModelConfig | null | undefined;
}

/**
 * Render-time state derived from the prompt, the organization's models and the active model's
 * config: the selectable model list, readiness/validity flags and the options the blocks offer.
 */
export function useDerivedModelState({
	prompt,
	models,
	selectedModelName,
	selectedModelId,
	activeModelConfig,
}: UseDerivedModelStateProps) {
	// The React Compiler lint infers `prompt` for these two memos where their deps name
	// `prompt?.languageModel`. The deps are kept as they were: the lint never checked them inside
	// useModelsSettings, which it skips for calling watch().
	// eslint-disable-next-line react-hooks/preserve-manual-memoization -- deps kept as they were
	const effectiveModels = useMemo((): Model[] => {
		const promptModelId = prompt?.languageModel?.id;
		// A retired model is offered to no one; it stays visible, unselectable, only on the
		// prompt still assigned to it, so its owner sees what to move off.
		const base = ((models as Model[]) ?? [])
			.filter((m) => !isRetired(m) || m.id === promptModelId)
			.map((m) => (isRetired(m) ? { ...m, isDisabled: true } : m));
		if (!prompt?.languageModel) return base;
		const alreadyPresent = base.some((m) => m.id === prompt.languageModel.id);
		if (alreadyPresent) return base;
		return [...base, { ...prompt.languageModel, isDisabled: true }];
	}, [models, prompt?.languageModel]);

	const currentModel = effectiveModels.find((model) => model.name === selectedModelName);
	// eslint-disable-next-line react-hooks/preserve-manual-memoization -- deps kept as they were
	const shouldShowModelStatusState = useMemo(() => {
		if (!prompt?.languageModel) {
			return true;
		}

		if (!selectedModelName || !selectedModelId) {
			return false;
		}

		const areOrgModelsLoaded = (models?.length ?? 0) > 0;
		const isPromptFallbackModel =
			selectedModelName === prompt.languageModel.name && currentModel?.isDisabled === true;

		if (!areOrgModelsLoaded && isPromptFallbackModel) {
			return false;
		}

		return true;
	}, [
		currentModel?.isDisabled,
		models?.length,
		prompt?.languageModel,
		selectedModelId,
		selectedModelName,
	]);

	const isCurrentModelReasoning = Boolean(activeModelConfig?.parameters?.reasoning_effort);

	const isDataReady = useMemo(() => {
		return !!(prompt && effectiveModels.length > 0);
	}, [prompt, effectiveModels]);

	const isFormValid = useMemo(() => {
		if (!prompt?.languageModel) {
			return false;
		}
		return !!selectedModelName && !!selectedModelId;
	}, [selectedModelName, selectedModelId, prompt?.languageModel]);

	const groupedModels = useMemo(() => {
		return groupModelsByVendor(effectiveModels);
	}, [effectiveModels]);

	const getResponseFormatOptions = useMemo(() => {
		const configOptions = activeModelConfig?.parameters.response_format?.allowed || ["text"];

		if (
			prompt?.languageModelConfig?.response_format === "json_schema" &&
			!configOptions.includes("json_schema")
		) {
			return [...configOptions, "json_schema"];
		}

		return configOptions;
	}, [activeModelConfig, prompt?.languageModelConfig?.response_format]);

	const excludedParams = useMemo(() => {
		const base = ["response_format", "tools"];
		if (isCurrentModelReasoning) base.push("reasoning_effort");
		return base;
	}, [isCurrentModelReasoning]);

	return {
		effectiveModels,
		currentModel,
		shouldShowModelStatusState,
		isCurrentModelReasoning,
		isDataReady,
		isFormValid,
		groupedModels,
		getResponseFormatOptions,
		excludedParams,
	};
}
