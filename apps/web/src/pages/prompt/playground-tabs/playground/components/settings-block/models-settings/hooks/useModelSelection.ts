import { useEffect, useCallback, useRef, type MutableRefObject } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { UseFormReset, UseFormSetValue } from "react-hook-form";
import type { useToast } from "@/hooks/useToast";
import { modelsSettingsKeys } from "@/query-keys/models-settings.keys";
import type { useModelsSettingsActions } from "@/stores/modelsSettings.store";
import type { PromptSettings } from "@/types/Prompt";
import type { Model, ResponseModelConfig } from "@/types/AIModel";
import { isRetired, lifecycleNotice } from "@/lib/modelLifecycle";
import { getFormValuesFromPrompt } from "../utils/payload";
import type { ModelSettingsFormValues } from "../utils/types";
import type { DraftPersistence } from "./useDraftPersistence";
import type { UiStateSetter } from "./useUiStateSetter";

type ModelsSettingsActions = ReturnType<typeof useModelsSettingsActions>;

interface UseModelSelectionProps {
	prompt?: PromptSettings;
	models?: Model[];
	promptId?: number;
	isUpdatingPromptContent?: boolean;
	effectiveModels: Model[];
	selectedModelName: string;
	selectedModelId: number | null;
	isUpdatingModel: boolean;
	setValue: UseFormSetValue<ModelSettingsFormValues>;
	reset: UseFormReset<ModelSettingsFormValues>;
	setDraft: ModelsSettingsActions["setDraft"];
	bumpForceRenderKey: ModelsSettingsActions["bumpForceRenderKey"];
	setIsUpdatingModel: UiStateSetter<"isUpdatingModel">;
	setIsChangingModel: UiStateSetter<"isChangingModel">;
	setSelectedModelName: UiStateSetter<"selectedModelName">;
	setSelectedModelId: UiStateSetter<"selectedModelId">;
	setCurrentResponseFormat: UiStateSetter<"currentResponseFormat">;
	setCurrentJsonSchema: UiStateSetter<"currentJsonSchema">;
	updatePromptModel: (targetPromptId: number, modelId: number) => Promise<boolean>;
	getCommitStatus: () => Promise<PromptSettings | null>;
	queryClient: QueryClient;
	toast: ReturnType<typeof useToast>["toast"];
	syncDraftFromForm: DraftPersistence["syncDraftFromForm"];
	debouncedUpdateSettings: DraftPersistence["debouncedUpdateSettings"];
	justChangedModelRef: MutableRefObject<boolean>;
	isSyncingFromBackendRef: MutableRefObject<boolean>;
}

/**
 * The selected model: switching it on the backend and loading the new model's config into the
 * form, and following the prompt's own model whenever no switch is in flight.
 */
export function useModelSelection({
	prompt,
	models,
	promptId,
	isUpdatingPromptContent,
	effectiveModels,
	selectedModelName,
	selectedModelId,
	isUpdatingModel,
	setValue,
	reset,
	setDraft,
	bumpForceRenderKey,
	setIsUpdatingModel,
	setIsChangingModel,
	setSelectedModelName,
	setSelectedModelId,
	setCurrentResponseFormat,
	setCurrentJsonSchema,
	updatePromptModel,
	getCommitStatus,
	queryClient,
	toast,
	syncDraftFromForm,
	debouncedUpdateSettings,
	justChangedModelRef,
	isSyncingFromBackendRef,
}: UseModelSelectionProps) {
	const userSelectionInProgress = useRef<boolean>(false);
	const isInitialized = useRef<boolean>(false);

	const handleModelChange = useCallback(
		async (value: string) => {
			const model = effectiveModels.find((m) => m.name === value);
			if (!model || !promptId || isUpdatingModel) {
				return;
			}
			if (model.isDisabled) {
				toast({
					title: isRetired(model) ? "Model retired" : "Model disabled",
					description:
						lifecycleNotice(model.lifecycle) ??
						"This model is disabled for your organization. Please contact your administrator.",
					variant: "destructive",
				});
				return;
			}

			userSelectionInProgress.current = true;
			setIsUpdatingModel(true);
			setIsChangingModel(true);
			justChangedModelRef.current = true;
			debouncedUpdateSettings.cancel();

			setSelectedModelName(value);
			setSelectedModelId(model.id);

			try {
				await updatePromptModel(promptId, model.id);
				const cachedTargetConfig =
					queryClient.getQueryData<ResponseModelConfig | null>(
						modelsSettingsKeys.modelConfig(model.id),
					) ?? null;
				const updatedPrompt = await getCommitStatus();
				await new Promise((resolve) => setTimeout(resolve, 300));

				isSyncingFromBackendRef.current = true;
				try {
					if (
						updatedPrompt?.languageModelConfig &&
						updatedPrompt?.languageModel?.id === model.id
					) {
						const backendConfig = updatedPrompt.languageModelConfig;
						const backendResponseFormat = String(
							backendConfig.response_format ||
								cachedTargetConfig?.parameters?.response_format?.default ||
								"text",
						);

						setValue("responseFormat", backendResponseFormat, {
							shouldValidate: false,
						});
						setCurrentResponseFormat(backendResponseFormat);

						if (backendConfig.json_schema) {
							const jsonSchema =
								typeof backendConfig.json_schema === "string"
									? backendConfig.json_schema
									: JSON.stringify(backendConfig.json_schema);
							setCurrentJsonSchema(jsonSchema);
						} else {
							setCurrentJsonSchema(null);
						}

						setValue("maxTokens", backendConfig.max_tokens ?? null, {
							shouldValidate: false,
						});
						setValue("temperature", backendConfig.temperature ?? null, {
							shouldValidate: false,
						});
						setValue("topP", backendConfig.top_p ?? null, {
							shouldValidate: false,
						});
						setValue("frequencyPenalty", backendConfig.frequency_penalty ?? null, {
							shouldValidate: false,
						});
						setValue("presencePenalty", backendConfig.presence_penalty ?? null, {
							shouldValidate: false,
						});
						setValue("reasoningEffort", backendConfig.reasoning_effort ?? null, {
							shouldValidate: false,
						});
						setValue("verbosity", backendConfig.verbosity ?? null, {
							shouldValidate: false,
						});
						syncDraftFromForm({
							selectedModelId: model.id,
							responseFormat: backendResponseFormat,
							currentResponseFormat: backendResponseFormat,
							jsonSchema: backendConfig.json_schema
								? typeof backendConfig.json_schema === "string"
									? backendConfig.json_schema
									: JSON.stringify(backendConfig.json_schema)
								: null,
						});
					} else {
						const defaultResponseFormat = String(
							cachedTargetConfig?.parameters?.response_format?.default || "text",
						);
						setValue("responseFormat", defaultResponseFormat, {
							shouldValidate: false,
						});
						setCurrentResponseFormat(defaultResponseFormat);
						setCurrentJsonSchema(null);
						syncDraftFromForm({
							selectedModelId: model.id,
							responseFormat: defaultResponseFormat,
							currentResponseFormat: defaultResponseFormat,
							jsonSchema: null,
						});
					}
				} finally {
					isSyncingFromBackendRef.current = false;
				}

				bumpForceRenderKey(promptId);
				setIsChangingModel(false);

				setTimeout(() => {
					justChangedModelRef.current = false;
				}, 1000);

				toast({
					title: "Success",
					description: `Model changed to ${model.name}`,
				});
			} catch (error) {
				console.error("❌ Error changing model:", error);
				toast({
					title: "Error",
					description: "Failed to change model",
					variant: "destructive",
				});
				justChangedModelRef.current = false;
			} finally {
				setIsUpdatingModel(false);
				setTimeout(() => {
					userSelectionInProgress.current = false;
				}, 500);
			}
		},
		[
			effectiveModels,
			promptId,
			isUpdatingModel,
			debouncedUpdateSettings,
			updatePromptModel,
			queryClient,
			setValue,
			getCommitStatus,
			toast,
			setIsUpdatingModel,
			setIsChangingModel,
			setSelectedModelName,
			setSelectedModelId,
			setCurrentResponseFormat,
			setCurrentJsonSchema,
			syncDraftFromForm,
			bumpForceRenderKey,
			justChangedModelRef,
			isSyncingFromBackendRef,
		],
	);

	useEffect(() => {
		if (
			prompt &&
			!prompt.languageModel &&
			models &&
			models.length > 0 &&
			!isInitialized.current
		) {
			isInitialized.current = true;
			return;
		}

		if (!prompt?.languageModel) {
			if (selectedModelName && selectedModelId) {
				return;
			}
			return;
		}

		if (isUpdatingModel || userSelectionInProgress.current) {
			return;
		}

		if (!isInitialized.current && !isUpdatingPromptContent) {
			const promptModelName = prompt.languageModel.name;
			const promptModelId = prompt.languageModel.id;
			setSelectedModelName(promptModelName);
			setSelectedModelId(promptModelId);
			const formValues = getFormValuesFromPrompt(prompt);
			reset(formValues);
			setDraft(promptId, {
				...formValues,
				selectedModelId: promptModelId,
				tools: prompt?.languageModelConfig?.tools || [],
				jsonSchema:
					typeof prompt?.languageModelConfig?.json_schema === "string"
						? prompt.languageModelConfig.json_schema
						: prompt?.languageModelConfig?.json_schema
							? JSON.stringify(prompt.languageModelConfig.json_schema)
							: null,
				currentResponseFormat: String(formValues.responseFormat || ""),
				isSchemaCleared: false,
			});
			bumpForceRenderKey(promptId);
			isInitialized.current = true;
		}

		if (
			isInitialized.current &&
			!isUpdatingPromptContent &&
			!isUpdatingModel &&
			!userSelectionInProgress.current &&
			!isSyncingFromBackendRef.current
		) {
			const promptModelName = prompt.languageModel.name;
			const promptModelId = prompt.languageModel.id;

			if (selectedModelName !== promptModelName || selectedModelId !== promptModelId) {
				setSelectedModelName(promptModelName);
				setSelectedModelId(promptModelId);
				const formValues = getFormValuesFromPrompt(prompt);
				reset(formValues);
				setDraft(promptId, {
					...formValues,
					selectedModelId: promptModelId,
					tools: prompt?.languageModelConfig?.tools || [],
					jsonSchema:
						typeof prompt?.languageModelConfig?.json_schema === "string"
							? prompt.languageModelConfig.json_schema
							: prompt?.languageModelConfig?.json_schema
								? JSON.stringify(prompt.languageModelConfig.json_schema)
								: null,
					currentResponseFormat: String(formValues.responseFormat || ""),
					isSchemaCleared: false,
				});
				bumpForceRenderKey(promptId);
			}
		}
	}, [
		models,
		isUpdatingModel,
		selectedModelName,
		selectedModelId,
		isUpdatingPromptContent,
		reset,
		prompt,
		setSelectedModelName,
		setSelectedModelId,
		setDraft,
		bumpForceRenderKey,
		promptId,
		isSyncingFromBackendRef,
	]);

	return { handleModelChange };
}
