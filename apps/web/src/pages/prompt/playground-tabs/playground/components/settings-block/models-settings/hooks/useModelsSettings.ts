import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import { usePromptStatus } from "@/contexts/PromptStatusContext";
import { useRefreshCommitStatus } from "@/hooks/useRefreshCommitStatus";
import { useModelsSettingsActions, useModelsSettingsUI } from "@/stores/modelsSettings.store";
import type { PromptSettings } from "@/types/Prompt";
import type { Model } from "@/types/AIModel";
import { modelSettingsSchema } from "../utils/schema";
import { getFormValuesFromPrompt } from "../utils/payload";
import type { ModelSettingsFormValues } from "../utils/types";
import { useDerivedModelState } from "./useDerivedModelState";
import { useDraftPersistence, useFormChangeSubscription } from "./useDraftPersistence";
import { useModelSelection } from "./useModelSelection";
import { useModelSettingsApi } from "./useModelSettingsApi";
import { useModelTools } from "./useModelTools";
import { useResponseFormatSettings } from "./useResponseFormatSettings";
import { useUiStateSetter } from "./useUiStateSetter";

interface UseModelsSettingsProps {
	prompt?: PromptSettings;
	models?: Model[];
	propPromptId?: number;
	onValidationChange?: (isValid: boolean) => void;
	isUpdatingPromptContent?: boolean;
}

/**
 * Composes the models-settings hooks. Their call order is load-bearing: React runs effects in
 * declaration order, and the effects must keep this sequence — sync the selected model from the
 * prompt (useModelSelection), report validity (here), subscribe to form changes
 * (useFormChangeSubscription), sync the tools (useModelTools), then sync the JSON schema and
 * reset `isSchemaCleared` (useResponseFormatSettings).
 */
export function useModelsSettings({
	prompt,
	models,
	propPromptId,
	onValidationChange,
	isUpdatingPromptContent,
}: UseModelsSettingsProps) {
	const { toast } = useToast();
	const { id } = useParams<{ id: string }>();
	const { setIsCommitted } = usePromptStatus();
	const queryClient = useQueryClient();

	const promptId = prompt?.id || (id ? Number(id) : propPromptId);

	const ui = useModelsSettingsUI(promptId);
	const { setUiState, setDraft, getDraft, bumpForceRenderKey } = useModelsSettingsActions();

	const setSchemaDialogOpen = useUiStateSetter(promptId, setUiState, "schemaDialogOpen");
	const setToolsModalOpen = useUiStateSetter(promptId, setUiState, "toolsModalOpen");
	const setIsUpdatingModel = useUiStateSetter(promptId, setUiState, "isUpdatingModel");
	const setIsChangingModel = useUiStateSetter(promptId, setUiState, "isChangingModel");
	const setCurrentJsonSchema = useUiStateSetter(promptId, setUiState, "currentJsonSchema");
	const setCurrentResponseFormat = useUiStateSetter(
		promptId,
		setUiState,
		"currentResponseFormat",
	);
	const setIsSchemaCleared = useUiStateSetter(promptId, setUiState, "isSchemaCleared");
	const setSelectedModelName = useUiStateSetter(promptId, setUiState, "selectedModelName");
	const setSelectedModelId = useUiStateSetter(promptId, setUiState, "selectedModelId");
	const setTools = useUiStateSetter(promptId, setUiState, "tools");
	const setEditingToolIdx = useUiStateSetter(promptId, setUiState, "editingToolIdx");
	const setEditingTool = useUiStateSetter(promptId, setUiState, "editingTool");

	const {
		schemaDialogOpen,
		toolsModalOpen,
		isUpdatingModel,
		isChangingModel,
		forceRenderKey,
		currentJsonSchema,
		currentResponseFormat,
		isSchemaCleared,
		selectedModelName,
		selectedModelId,
		tools,
		editingToolIdx,
		editingTool,
	} = ui;
	const modelConfigTargetId = selectedModelId ?? prompt?.languageModel?.id ?? null;

	const justChangedModel = useRef<boolean>(false);
	const isSyncingFromBackend = useRef(false);

	const {
		activeModelConfig,
		loading,
		getModelConfig,
		updatePromptModel,
		updateModelSettings,
		getCommitStatus,
	} = useModelSettingsApi({
		promptId,
		modelConfigTargetId,
		isUpdatingModel,
		queryClient,
		setIsCommitted,
	});

	const form = useForm<ModelSettingsFormValues>({
		resolver: zodResolver(modelSettingsSchema),
		defaultValues: {
			selectedModel: "",
			selectedModelId: null,
			maxTokens: null,
			temperature: null,
			topP: null,
			frequencyPenalty: null,
			presencePenalty: null,
			responseFormat: "",
			reasoningEffort: null,
			verbosity: null,
		},
		mode: "onChange",
	});

	const { control, watch, setValue, getValues, reset } = form;
	const responseFormat = watch("responseFormat");

	const {
		effectiveModels,
		currentModel,
		shouldShowModelStatusState,
		isCurrentModelReasoning,
		isDataReady,
		isFormValid,
		groupedModels,
		getResponseFormatOptions,
		excludedParams,
	} = useDerivedModelState({
		prompt,
		models,
		selectedModelName,
		selectedModelId,
		activeModelConfig,
	});

	const refreshCommitStatus = useRefreshCommitStatus(promptId, setIsCommitted);

	const {
		syncDraftFromForm,
		persistLatestDraft,
		debouncedUpdateSettings,
		onFormChange,
		getPayload,
	} = useDraftPersistence({
		promptId,
		prompt,
		selectedModelId,
		tools,
		currentJsonSchema,
		currentResponseFormat,
		isSchemaCleared,
		activeModelConfig,
		getValues,
		setDraft,
		getDraft,
		updateModelSettings,
		getCommitStatus,
		getModelConfig,
		toast,
	});

	const { handleModelChange } = useModelSelection({
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
		justChangedModelRef: justChangedModel,
		isSyncingFromBackendRef: isSyncingFromBackend,
	});

	useEffect(() => {
		onValidationChange?.(isFormValid);
	}, [isFormValid, onValidationChange]);

	useFormChangeSubscription({
		watch,
		isSyncingFromBackendRef: isSyncingFromBackend,
		onFormChange,
		debouncedUpdateSettings,
	});

	const { handleToolDelete, handleToolSave } = useModelTools({
		prompt,
		promptId,
		tools,
		isUpdatingModel,
		setTools,
		setDraft,
		syncDraftFromForm,
		persistLatestDraft,
		debouncedUpdateSettings,
		justChangedModelRef: justChangedModel,
	});

	const { handleResponseFormatChange, onSaveSchema } = useResponseFormatSettings({
		prompt,
		promptId,
		selectedModelId,
		currentJsonSchema,
		setCurrentJsonSchema,
		setCurrentResponseFormat,
		setIsSchemaCleared,
		setDraft,
		syncDraftFromForm,
		persistLatestDraft,
		toast,
	});

	return {
		form,
		control,
		responseFormat,

		isUpdatingModel,
		isChangingModel,
		isDataReady,
		isFormValid,
		loading,
		forceRenderKey,

		effectiveModels,
		selectedModelName,
		selectedModelId,
		currentModel,
		activeModelConfig,
		shouldShowModelStatusState,
		isCurrentModelReasoning,
		groupedModels,
		getResponseFormatOptions,
		excludedParams,
		promptId,

		tools,
		setTools,
		editingToolIdx,
		setEditingToolIdx,
		editingTool,
		setEditingTool,

		currentJsonSchema,
		setCurrentJsonSchema,
		currentResponseFormat,
		setCurrentResponseFormat,

		schemaDialogOpen,
		setSchemaDialogOpen,
		toolsModalOpen,
		setToolsModalOpen,

		handleModelChange,
		handleResponseFormatChange,
		onSaveSchema,
		onFormChange,
		handleToolDelete,
		handleToolSave,
		debouncedUpdateSettings,
		getCommitStatus,
		refreshCommitStatus,
		getModelConfig,
		updateModelSettings,

		isSyncingFromBackend,
		justChangedModel,

		getFormValuesFromPrompt: () => getFormValuesFromPrompt(prompt),
		buildPayload: getPayload,
	};
}
