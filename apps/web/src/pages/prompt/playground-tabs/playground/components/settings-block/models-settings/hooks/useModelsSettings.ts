import { useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "react-router-dom";
import debounce from "lodash.debounce";
import { useToast } from "@/hooks/useToast";
import { usePromptStatus } from "@/contexts/PromptStatusContext";
import { useRefreshCommitStatus } from "@/hooks/useRefreshCommitStatus";
import { promptApi } from "@/api/prompt";
import { promptKeys } from "@/query-keys/prompt.keys";
import { modelsSettingsKeys } from "@/query-keys/models-settings.keys";
import { useModelsSettingsActions, useModelsSettingsUI } from "@/stores/modelsSettings.store";
import type { PromptSettings } from "@/types/Prompt";
import type { Model, ResponseModelConfig } from "@/types/AIModel";
import { modelSettingsSchema } from "../utils/schema";
import { buildModelSettingsPayload, getFormValuesFromPrompt } from "../utils/payload";
import { groupModelsByVendor } from "../utils/helpers";
import type { ModelSettingsFormValues, ToolItem } from "../utils/types";

interface UseModelsSettingsProps {
	prompt?: PromptSettings;
	models?: Model[];
	propPromptId?: number;
	onValidationChange?: (isValid: boolean) => void;
	isUpdatingPromptContent?: boolean;
}

type PromptResponse = {
	prompt: PromptSettings;
};

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

	const setSchemaDialogOpen = useCallback(
		(open: boolean) => setUiState(promptId, { schemaDialogOpen: open }),
		[promptId, setUiState],
	);
	const setToolsModalOpen = useCallback(
		(open: boolean) => setUiState(promptId, { toolsModalOpen: open }),
		[promptId, setUiState],
	);
	const setIsUpdatingModel = useCallback(
		(value: boolean) => setUiState(promptId, { isUpdatingModel: value }),
		[promptId, setUiState],
	);
	const setIsChangingModel = useCallback(
		(value: boolean) => setUiState(promptId, { isChangingModel: value }),
		[promptId, setUiState],
	);
	const setCurrentJsonSchema = useCallback(
		(value: string | null) => setUiState(promptId, { currentJsonSchema: value }),
		[promptId, setUiState],
	);
	const setCurrentResponseFormat = useCallback(
		(value: string) => setUiState(promptId, { currentResponseFormat: value }),
		[promptId, setUiState],
	);
	const setIsSchemaCleared = useCallback(
		(value: boolean) => setUiState(promptId, { isSchemaCleared: value }),
		[promptId, setUiState],
	);
	const setSelectedModelName = useCallback(
		(value: string) => setUiState(promptId, { selectedModelName: value }),
		[promptId, setUiState],
	);
	const setSelectedModelId = useCallback(
		(value: number | null) => setUiState(promptId, { selectedModelId: value }),
		[promptId, setUiState],
	);
	const setTools = useCallback(
		(value: ToolItem[]) => setUiState(promptId, { tools: value }),
		[promptId, setUiState],
	);
	const setEditingToolIdx = useCallback(
		(value: number | null) => setUiState(promptId, { editingToolIdx: value }),
		[promptId, setUiState],
	);
	const setEditingTool = useCallback(
		(value: ToolItem | null) => setUiState(promptId, { editingTool: value }),
		[promptId, setUiState],
	);

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

	const userSelectionInProgress = useRef<boolean>(false);
	const isInitialized = useRef<boolean>(false);
	const justChangedModel = useRef<boolean>(false);
	const isSyncingFromBackend = useRef(false);
	const isPersistingDraftRef = useRef(false);
	const hasQueuedDraftRef = useRef(false);

	const modelConfigQuery = useQuery({
		queryKey: modelsSettingsKeys.modelConfig(modelConfigTargetId),
		queryFn: async (): Promise<ResponseModelConfig | null> => {
			if (!modelConfigTargetId) return null;
			const data = await promptApi.getModelConfig(modelConfigTargetId);
			return data.config;
		},
		enabled: !!modelConfigTargetId && !isUpdatingModel,
		refetchOnWindowFocus: false,
		placeholderData: (previousData) => previousData,
	});

	const updatePromptModelMutation = useMutation({
		mutationKey: modelsSettingsKeys.updatePromptModel(promptId),
		mutationFn: async ({
			targetPromptId,
			modelId,
		}: {
			targetPromptId: number;
			modelId: number;
		}) => promptApi.updatePromptModel(targetPromptId, modelId),
		onSuccess: (result) => {
			if (promptId) {
				queryClient.setQueryData(promptKeys.byId(promptId), result);
			}
		},
	});

	const updateModelSettingsMutation = useMutation({
		mutationKey: modelsSettingsKeys.updatePromptConfig(promptId),
		mutationFn: async ({
			targetPromptId,
			payload,
		}: {
			targetPromptId: number;
			payload: Record<string, unknown>;
		}) => promptApi.updateModelConfig(targetPromptId, payload),
		onSuccess: (result) => {
			if (promptId) {
				queryClient.setQueryData(promptKeys.byId(promptId), result);
			}
		},
	});

	const getModelConfig = useCallback(
		async (modelId: number): Promise<ResponseModelConfig | null> => {
			if (!modelId) return null;
			return queryClient.fetchQuery({
				queryKey: modelsSettingsKeys.modelConfig(modelId),
				queryFn: async () => {
					const response = await promptApi.getModelConfig(modelId);
					return response.config;
				},
			});
		},
		[queryClient],
	);

	const updatePromptModel = useCallback(
		async (targetPromptId: number, modelId: number): Promise<boolean> => {
			if (!targetPromptId || !modelId) return false;
			await updatePromptModelMutation.mutateAsync({ targetPromptId, modelId });
			return true;
		},
		[updatePromptModelMutation],
	);

	const updateModelSettings = useCallback(
		async (targetPromptId: number, payload: Record<string, unknown>): Promise<boolean> => {
			if (!targetPromptId) return false;
			await updateModelSettingsMutation.mutateAsync({ targetPromptId, payload });
			return true;
		},
		[updateModelSettingsMutation],
	);

	const getCommitStatus = useCallback(async () => {
		if (!promptId) return null;
		try {
			const result = await queryClient.fetchQuery<PromptResponse>({
				queryKey: promptKeys.byId(promptId),
				queryFn: () => promptApi.getPrompt(promptId),
			});
			if (result.prompt) {
				const commited = result.prompt.commited || false;
				setIsCommitted(commited);
				return result.prompt;
			}
		} catch (error) {
			console.error("❌ Failed to get commit status:", error);
		}
		return null;
	}, [promptId, queryClient, setIsCommitted]);

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

	const effectiveModels = useMemo((): Model[] => {
		const base = (models as Model[]) ?? [];
		if (!prompt?.languageModel) return base;
		const alreadyPresent = base.some((m) => m.id === prompt.languageModel.id);
		if (alreadyPresent) return base;
		return [...base, { ...prompt.languageModel, isDisabled: true }];
	}, [models, prompt?.languageModel]);

	const currentModel = effectiveModels.find((model) => model.name === selectedModelName);
	const activeModelConfig = modelConfigQuery.data;

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

	const refreshCommitStatus = useRefreshCommitStatus(promptId, setIsCommitted);

	const loading = updatePromptModelMutation.isPending || updateModelSettingsMutation.isPending;

	const syncDraftFromForm = useCallback(
		(overrides: Record<string, unknown> = {}) => {
			if (!promptId) return;
			setDraft(promptId, {
				...(getValues() as Partial<ModelSettingsFormValues>),
				selectedModelId,
				tools,
				jsonSchema: currentJsonSchema,
				currentResponseFormat,
				isSchemaCleared,
				...overrides,
			});
		},
		[
			promptId,
			setDraft,
			getValues,
			selectedModelId,
			tools,
			currentJsonSchema,
			currentResponseFormat,
			isSchemaCleared,
		],
	);

	const persistLatestDraft = useCallback(
		async function persistLatestDraftImpl() {
			if (!promptId) {
				return;
			}

			if (isPersistingDraftRef.current) {
				hasQueuedDraftRef.current = true;
				return;
			}

			isPersistingDraftRef.current = true;

			try {
				const draftValues = getDraft(promptId);
				if (Object.keys(draftValues).length === 0) {
					return;
				}
				const draftSelectedModelId = draftValues.selectedModelId ?? selectedModelId;
				if (!draftSelectedModelId) {
					return;
				}
				const draftTools = draftValues.tools ?? tools;
				const draftCurrentResponseFormat =
					draftValues.currentResponseFormat ?? currentResponseFormat;
				const draftResponseFormat = String(
					draftValues.responseFormat ?? draftCurrentResponseFormat,
				);
				const draftJsonSchema =
					draftValues.jsonSchema !== undefined
						? draftValues.jsonSchema
						: currentJsonSchema;
				const draftIsSchemaCleared = draftValues.isSchemaCleared ?? isSchemaCleared;

				const payload = buildModelSettingsPayload({
					parameters: activeModelConfig?.parameters || {},
					formValues: draftValues as unknown as Record<string, unknown>,
					tools: draftTools,
					responseFormat: draftResponseFormat,
					jsonSchema: draftJsonSchema,
					selectedModelId: draftSelectedModelId,
					currentResponseFormat: draftCurrentResponseFormat,
					prompt,
					allowPromptJsonSchemaFallback: !draftIsSchemaCleared,
				});

				await updateModelSettings(promptId, payload);
				await new Promise((resolve) => setTimeout(resolve, 200));
				await getCommitStatus();
				await getModelConfig(draftSelectedModelId);
			} catch (error) {
				console.error("❌ Error updating model settings:", error);
				toast({
					title: "Error",
					description: "Failed to update model settings",
					variant: "destructive",
				});
			} finally {
				isPersistingDraftRef.current = false;
				if (hasQueuedDraftRef.current) {
					hasQueuedDraftRef.current = false;
					void persistLatestDraftImpl();
				}
			}
		},
		[
			selectedModelId,
			promptId,
			getDraft,
			activeModelConfig,
			tools,
			currentJsonSchema,
			currentResponseFormat,
			prompt,
			isSchemaCleared,
			updateModelSettings,
			getCommitStatus,
			getModelConfig,
			toast,
		],
	);

	const debouncedUpdateSettings = useMemo(
		() => debounce(() => void persistLatestDraft(), 500),
		[persistLatestDraft],
	);

	const onFormChange = useCallback(
		(overrides: Partial<ModelSettingsFormValues> = {}, options?: { immediate?: boolean }) => {
			if (!promptId || !selectedModelId) return;
			syncDraftFromForm(overrides);
			if (options?.immediate) {
				debouncedUpdateSettings.cancel();
				void persistLatestDraft();
				return;
			}
			debouncedUpdateSettings();
		},
		[promptId, selectedModelId, syncDraftFromForm, debouncedUpdateSettings, persistLatestDraft],
	);

	const handleModelChange = useCallback(
		async (value: string) => {
			const model = effectiveModels.find((m) => m.name === value);
			if (!model || !promptId || isUpdatingModel) {
				return;
			}
			if (model.isDisabled) {
				toast({
					title: "Model disabled",
					description:
						"This model is disabled for your organization. Please contact your administrator.",
					variant: "destructive",
				});
				return;
			}

			userSelectionInProgress.current = true;
			setIsUpdatingModel(true);
			setIsChangingModel(true);
			justChangedModel.current = true;
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

				isSyncingFromBackend.current = true;
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
					isSyncingFromBackend.current = false;
				}

				bumpForceRenderKey(promptId);
				setIsChangingModel(false);

				setTimeout(() => {
					justChangedModel.current = false;
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
				justChangedModel.current = false;
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
		],
	);

	const handleResponseFormatChange = useCallback(
		async (value: string) => {
			if (!selectedModelId || !promptId) {
				return;
			}
			try {
				setCurrentResponseFormat(String(value));
				if (value !== "json_schema") {
					setCurrentJsonSchema(null);
					setIsSchemaCleared(true);
				}
				syncDraftFromForm({
					responseFormat: value,
					currentResponseFormat: value,
					jsonSchema: value === "json_schema" ? currentJsonSchema : null,
					isSchemaCleared: value !== "json_schema",
				});
				await persistLatestDraft();
			} catch (error) {
				console.error("❌ Error updating response format:", error);
				toast({
					title: "Error",
					description: "Failed to update response format",
					variant: "destructive",
				});
			}
		},
		[
			selectedModelId,
			promptId,
			currentJsonSchema,
			toast,
			syncDraftFromForm,
			persistLatestDraft,
			setCurrentJsonSchema,
			setCurrentResponseFormat,
			setIsSchemaCleared,
		],
	);

	const onSaveSchema = useCallback(
		async (data: { json_schema: string }) => {
			if (!promptId) {
				return;
			}
			try {
				const jsonSchemaString = data.json_schema;
				setCurrentJsonSchema(jsonSchemaString);
				setCurrentResponseFormat("json_schema");
				setIsSchemaCleared(false);
				syncDraftFromForm({
					responseFormat: "json_schema",
					currentResponseFormat: "json_schema",
					jsonSchema: jsonSchemaString,
					isSchemaCleared: false,
				});
				await persistLatestDraft();
			} catch (error) {
				console.error("Failed to update schema:", error);
				if (prompt?.languageModelConfig) {
					const config = prompt.languageModelConfig;
					const jsonSchema = config.json_schema;
					setCurrentJsonSchema(
						typeof jsonSchema === "string"
							? jsonSchema
							: jsonSchema
								? JSON.stringify(jsonSchema)
								: null,
					);
					setCurrentResponseFormat(String(config.response_format || ""));
					setIsSchemaCleared(false);
				}
			}
		},
		[
			promptId,
			prompt,
			syncDraftFromForm,
			persistLatestDraft,
			setCurrentJsonSchema,
			setCurrentResponseFormat,
			setIsSchemaCleared,
		],
	);

	const getPayload = useCallback(
		(overrides: Partial<Parameters<typeof buildModelSettingsPayload>[0]>) =>
			buildModelSettingsPayload({
				parameters: activeModelConfig?.parameters || {},
				formValues: getValues() as unknown as Record<string, unknown>,
				tools,
				responseFormat: getValues().responseFormat || currentResponseFormat,
				jsonSchema: currentJsonSchema,
				selectedModelId,
				currentResponseFormat,
				prompt,
				allowPromptJsonSchemaFallback: !isSchemaCleared,
				...overrides,
			}),
		[
			activeModelConfig,
			getValues,
			tools,
			currentResponseFormat,
			currentJsonSchema,
			selectedModelId,
			prompt,
			isSchemaCleared,
		],
	);

	const handleToolDelete = useCallback(
		async (idx: number) => {
			debouncedUpdateSettings.cancel();
			justChangedModel.current = true;
			if (isUpdatingModel || !promptId) return;

			try {
				const updatedTools = tools.filter((_, i) => i !== idx);
				setTools(updatedTools);
				syncDraftFromForm({ tools: updatedTools });
				await persistLatestDraft();
			} catch {
				// Error handled in hook/api
			} finally {
				setTimeout(() => {
					justChangedModel.current = false;
				}, 1000);
			}
		},
		[
			debouncedUpdateSettings,
			isUpdatingModel,
			tools,
			promptId,
			setTools,
			syncDraftFromForm,
			persistLatestDraft,
		],
	);

	const handleToolSave = useCallback(
		async (newTools: ToolItem[], editingIdx: number | null) => {
			if (!promptId) return;
			let updatedTools: ToolItem[];
			if (editingIdx !== null && editingIdx >= 0) {
				updatedTools = tools.map((t, i) => (i === editingIdx ? newTools[0] : t));
			} else {
				updatedTools = [...tools, ...newTools];
			}
			setTools(updatedTools);
			syncDraftFromForm({ tools: updatedTools });
			await persistLatestDraft();
		},
		[tools, promptId, setTools, syncDraftFromForm, persistLatestDraft],
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
			!isSyncingFromBackend.current
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
	]);

	useEffect(() => {
		onValidationChange?.(isFormValid);
	}, [isFormValid, onValidationChange]);

	useEffect(() => {
		const subscription = watch((_, { name }) => {
			if (isSyncingFromBackend.current) {
				return;
			}

			const isSliderField =
				name === "maxTokens" ||
				name === "temperature" ||
				name === "topP" ||
				name === "frequencyPenalty" ||
				name === "presencePenalty";

			if (
				name &&
				name !== "selectedModel" &&
				name !== "selectedModelId" &&
				name !== "responseFormat" &&
				!isSliderField
			) {
				onFormChange();
			}
		});

		return () => {
			subscription.unsubscribe();
			debouncedUpdateSettings.cancel();
		};
	}, [watch, onFormChange, debouncedUpdateSettings]);

	useEffect(() => {
		const nextTools = prompt?.languageModelConfig?.tools || [];
		setTools(nextTools);
		if (promptId) {
			setDraft(promptId, { tools: nextTools });
		}
	}, [promptId, prompt?.languageModelConfig?.tools, setTools, setDraft]);

	useEffect(() => {
		if (prompt?.languageModelConfig?.json_schema) {
			const jsonSchema =
				typeof prompt.languageModelConfig.json_schema === "string"
					? prompt.languageModelConfig.json_schema
					: JSON.stringify(prompt.languageModelConfig.json_schema);
			setCurrentJsonSchema(jsonSchema);
			if (promptId) {
				setDraft(promptId, { jsonSchema });
			}
		} else {
			setCurrentJsonSchema(null);
			if (promptId) {
				setDraft(promptId, { jsonSchema: null });
			}
		}
	}, [promptId, prompt?.languageModelConfig?.json_schema, setCurrentJsonSchema, setDraft]);

	useEffect(() => {
		if (!promptId) return;
		setIsSchemaCleared(false);
	}, [promptId, setIsSchemaCleared]);

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
