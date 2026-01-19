import { useEffect, useCallback, useMemo, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "react-router-dom";
import debounce from "lodash.debounce";
import { usePromptsModels } from "@/hooks/usePromptsModels";
import { useToast } from "@/hooks/useToast";
import { usePromptStatus } from "@/contexts/PromptStatusContext";
import { useRefreshCommitStatus } from "@/hooks/useRefreshCommitStatus";
import { promptApi } from "@/api/prompt";
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

export function useModelsSettings({
	prompt,
	models,
	propPromptId,
	onValidationChange,
	isUpdatingPromptContent,
}: UseModelsSettingsProps) {
	// Dialog states
	const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);
	const [toolsModalOpen, setToolsModalOpen] = useState(false);

	// Model states
	const [isUpdatingModel, setIsUpdatingModel] = useState(false);
	const [isChangingModel, setIsChangingModel] = useState(false);
	const [forceRenderKey, setForceRenderKey] = useState(0);
	const [currentModelConfig, setCurrentModelConfig] = useState<ResponseModelConfig | null>(null);
	const [currentJsonSchema, setCurrentJsonSchema] = useState<string | null>(null);
	const [currentResponseFormat, setCurrentResponseFormat] = useState<string>("");
	const [selectedModelName, setSelectedModelName] = useState<string>("");
	const [selectedModelId, setSelectedModelId] = useState<number | null>(null);

	// Tools states
	const [tools, setTools] = useState<ToolItem[]>(prompt?.languageModelConfig?.tools || []);
	const [editingToolIdx, setEditingToolIdx] = useState<number | null>(null);
	const [editingTool, setEditingTool] = useState<ToolItem | null>(null);

	// Refs for tracking state
	const userSelectionInProgress = useRef<boolean>(false);
	const isInitialized = useRef<boolean>(false);
	const justChangedModel = useRef<boolean>(false);
	const isSyncingFromBackend = useRef(false);

	// Hooks
	const { getModelConfig, modelConfig, updateModelSettings, updatePromptModel, loading } =
		usePromptsModels();
	const { toast } = useToast();
	const { id } = useParams<{ id: string; orgId: string; projectId: string }>();
	const { setIsCommitted } = usePromptStatus();

	const promptId = prompt?.id || (id ? Number(id) : propPromptId);

	// Commit status helper
	const getCommitStatus = useCallback(async () => {
		if (!promptId) return null;
		try {
			const result = await promptApi.getPrompt(promptId as number);
			if (result.prompt) {
				const commited = result.prompt.commited || false;
				setIsCommitted(commited);
				return result.prompt;
			}
		} catch (error) {
			console.error("❌ Failed to get commit status:", error);
		}
		return null;
	}, [promptId, setIsCommitted]);

	// Form setup
	const form = useForm<ModelSettingsFormValues>({
		resolver: zodResolver(modelSettingsSchema),
		defaultValues: {
			selectedModel: "",
			selectedModelId: null,
			maxTokens: 0,
			temperature: 0,
			topP: 0,
			frequencyPenalty: 0,
			presencePenalty: 0,
			responseFormat: "",
			reasoningEffort: null,
			verbosity: null,
		},
		mode: "onChange",
	});

	const { control, watch, setValue, getValues, reset } = form;
	const responseFormat = watch("responseFormat");

	// Computed values
	const currentModel = models?.find((model) => model.name === selectedModelName);
	const activeModelConfig = currentModelConfig || modelConfig;

	const isCurrentModelReasoning = Boolean(activeModelConfig?.parameters?.reasoning_effort);

	const isDataReady = useMemo(() => {
		return !!(prompt && models && models.length > 0);
	}, [prompt, models]);

	const isFormValid = useMemo(() => {
		if (!prompt?.languageModel) {
			return false;
		}
		return !!selectedModelName && !!selectedModelId;
	}, [selectedModelName, selectedModelId, prompt?.languageModel]);

	const groupedModels = useMemo(() => {
		if (!models) return {};
		return groupModelsByVendor(models);
	}, [models]);

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

	// Debounced settings update
	const debouncedUpdateSettings = useMemo(
		() =>
			debounce(async () => {
				if (isUpdatingModel || !selectedModelId || justChangedModel.current) {
					return;
				}

				const formValues = getValues();
				const payload = buildModelSettingsPayload({
					parameters: activeModelConfig?.parameters || {},
					formValues: formValues as unknown as Record<string, unknown>,
					tools,
					responseFormat: formValues.responseFormat,
					jsonSchema: currentJsonSchema,
					selectedModelId,
					currentResponseFormat,
					prompt,
				});

				try {
					await updateModelSettings(promptId as number, payload);
					await new Promise((resolve) => setTimeout(resolve, 200));
					await getCommitStatus();
					if (selectedModelId) {
						await getModelConfig(selectedModelId);
					}
				} catch (error) {
					console.error("❌ Error updating model settings:", error);
					toast({
						title: "Error",
						description: "Failed to update model settings",
						variant: "destructive",
					});
				}
			}, 500),
		[
			updateModelSettings,
			isUpdatingModel,
			selectedModelId,
			getCommitStatus,
			toast,
			getValues,
			promptId,
			currentJsonSchema,
			currentResponseFormat,
			tools,
			activeModelConfig,
			prompt,
			getModelConfig,
		],
	);

	const onFormChange = useCallback(() => {
		if (isSyncingFromBackend.current) return;
		if (promptId && selectedModelId && !isUpdatingModel && !justChangedModel.current) {
			debouncedUpdateSettings();
		}
	}, [promptId, selectedModelId, debouncedUpdateSettings, isUpdatingModel]);

	// Model change handler
	const handleModelChange = useCallback(
		async (value: string) => {
			const model = models?.find((m) => m.name === value);
			if (!model || !promptId || isUpdatingModel) {
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
				const configResponse = await getModelConfig(model.id);
				setCurrentModelConfig(configResponse);
				const updatedPrompt = await getCommitStatus();

				setTimeout(() => {
					if (
						updatedPrompt?.languageModelConfig &&
						updatedPrompt?.languageModel?.id === model.id
					) {
						const backendConfig = updatedPrompt.languageModelConfig;
						const backendResponseFormat = String(
							backendConfig.response_format ||
								configResponse?.parameters?.response_format?.default ||
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

						// Sync all form values
						const fieldsToSync: Array<{
							key: keyof ModelSettingsFormValues;
							config: string;
						}> = [
							{ key: "maxTokens", config: "max_tokens" },
							{ key: "temperature", config: "temperature" },
							{ key: "topP", config: "top_p" },
							{ key: "frequencyPenalty", config: "frequency_penalty" },
							{ key: "presencePenalty", config: "presence_penalty" },
							{ key: "reasoningEffort", config: "reasoning_effort" },
							{ key: "verbosity", config: "verbosity" },
						];

						for (const field of fieldsToSync) {
							const configValue =
								backendConfig[field.config as keyof typeof backendConfig];
							if (configValue !== undefined && configValue !== null) {
								setValue(field.key, configValue as any, {
									shouldValidate: false,
								});
							} else {
								setValue(field.key, null, {
									shouldValidate: false,
								});
							}
						}
					} else {
						const defaultResponseFormat = String(
							configResponse?.parameters?.response_format?.default || "text",
						);
						setValue("responseFormat", defaultResponseFormat, {
							shouldValidate: false,
						});
						setCurrentResponseFormat(defaultResponseFormat);
						setCurrentJsonSchema(null);
					}

					setForceRenderKey((prev) => prev + 1);
					setIsChangingModel(false);

					setTimeout(() => {
						justChangedModel.current = false;
					}, 1000);
				}, 300);

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
			models,
			promptId,
			isUpdatingModel,
			debouncedUpdateSettings,
			updatePromptModel,
			getModelConfig,
			setValue,
			getCommitStatus,
			toast,
		],
	);

	// Response format change handler
	const handleResponseFormatChange = useCallback(
		async (value: string) => {
			if (!selectedModelId || isUpdatingModel) {
				return;
			}
			try {
				const formValues = getValues();
				const payload = buildModelSettingsPayload({
					parameters: activeModelConfig?.parameters || {},
					formValues: formValues as unknown as Record<string, unknown>,
					tools,
					responseFormat: value,
					jsonSchema: currentJsonSchema,
					selectedModelId,
					currentResponseFormat,
					prompt,
				});
				setCurrentResponseFormat(String(value));
				await updateModelSettings(promptId as number, payload);
				await new Promise((resolve) => setTimeout(resolve, 200));
				await getCommitStatus();
				if (selectedModelId) {
					await getModelConfig(selectedModelId);
				}
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
			isUpdatingModel,
			promptId,
			currentJsonSchema,
			updateModelSettings,
			getCommitStatus,
			toast,
			tools,
			getValues,
			currentResponseFormat,
			activeModelConfig,
			prompt,
			getModelConfig,
		],
	);

	// Schema save handler
	const onSaveSchema = useCallback(
		async (data: { json_schema: string }) => {
			if (promptId) {
				try {
					const jsonSchemaString = data.json_schema;
					setCurrentJsonSchema(jsonSchemaString);
					setCurrentResponseFormat("json_schema");
					const formValues = getValues();
					const payload = buildModelSettingsPayload({
						parameters: activeModelConfig?.parameters || {},
						formValues: formValues as unknown as Record<string, unknown>,
						tools,
						responseFormat: "json_schema",
						jsonSchema: jsonSchemaString,
						selectedModelId,
						currentResponseFormat: "json_schema",
						prompt,
					});
					await updateModelSettings(promptId, payload);
					await new Promise((resolve) => {
						setTimeout(async () => {
							await getCommitStatus();
							if (selectedModelId) {
								await getModelConfig(selectedModelId);
							}
							resolve(void 0);
						}, 200);
					});
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
					}
				}
			}
		},
		[
			promptId,
			selectedModelId,
			updateModelSettings,
			getCommitStatus,
			prompt?.languageModelConfig,
			tools,
			getValues,
			activeModelConfig,
			prompt,
			getModelConfig,
		],
	);

	// Build payload helper for internal use (avoids circular dependency in useCallback)
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
		],
	);

	const handleToolDelete = useCallback(
		async (idx: number) => {
			debouncedUpdateSettings.cancel();
			justChangedModel.current = true;
			if (isUpdatingModel) return;

			try {
				const updatedTools = tools.filter((_, i) => i !== idx);
				setTools(updatedTools);
				const payload = getPayload({ tools: updatedTools });
				await updateModelSettings(promptId as number, payload);
				await getCommitStatus();
				if (selectedModelId) {
					await getModelConfig(selectedModelId);
				}
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
			getPayload,
			updateModelSettings,
			promptId,
			getCommitStatus,
			selectedModelId,
			getModelConfig,
		],
	);

	const handleToolSave = useCallback(
		async (newTools: ToolItem[], editingIdx: number | null) => {
			let updatedTools: ToolItem[];
			if (editingIdx !== null && editingIdx >= 0) {
				updatedTools = tools.map((t, i) => (i === editingIdx ? newTools[0] : t));
			} else {
				updatedTools = [...tools, ...newTools];
			}
			setTools(updatedTools);

			const payload = getPayload({ tools: updatedTools });
			await updateModelSettings(promptId as number, payload);

			await getCommitStatus();
			if (selectedModelId) {
				await getModelConfig(selectedModelId);
			}
		},
		[
			tools,
			getPayload,
			updateModelSettings,
			promptId,
			getCommitStatus,
			selectedModelId,
			getModelConfig,
		],
	);

	// Effects for syncing state
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
			setForceRenderKey((prev) => prev + 1);
			isInitialized.current = true;
		}

		if (
			isInitialized.current &&
			!isUpdatingPromptContent &&
			!isUpdatingModel &&
			!userSelectionInProgress.current &&
			!justChangedModel.current &&
			!isSyncingFromBackend.current
		) {
			const promptModelName = prompt.languageModel.name;
			const promptModelId = prompt.languageModel.id;

			if (selectedModelName !== promptModelName || selectedModelId !== promptModelId) {
				setSelectedModelName(promptModelName);
				setSelectedModelId(promptModelId);
				const formValues = getFormValuesFromPrompt(prompt);
				reset(formValues);
				setForceRenderKey((prev) => prev + 1);
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
	]);

	// Load model config when model changes
	useEffect(() => {
		const loadModelConfig = async () => {
			if (selectedModelId && !isUpdatingModel && !justChangedModel.current) {
				try {
					const config = await getModelConfig(selectedModelId);
					setCurrentModelConfig(config as ResponseModelConfig);
				} catch (error) {
					console.error("Failed to load model config:", error);
					setCurrentModelConfig(null);
				}
			}
		};

		loadModelConfig();
	}, [selectedModelId, getModelConfig, isUpdatingModel]);

	// Notify parent of validation changes
	useEffect(() => {
		onValidationChange?.(isFormValid);
	}, [isFormValid, onValidationChange]);

	// Watch form changes
	useEffect(() => {
		const subscription = watch((_, { name }) => {
			if (isUpdatingModel || justChangedModel.current || isSyncingFromBackend.current) {
				return;
			}

			if (
				name &&
				name !== "selectedModel" &&
				name !== "selectedModelId" &&
				name !== "responseFormat"
			) {
				onFormChange();
			}
		});

		return () => {
			subscription.unsubscribe();
			debouncedUpdateSettings.cancel();
		};
	}, [watch, onFormChange, debouncedUpdateSettings, isUpdatingModel]);

	// Sync tools from prompt
	useEffect(() => {
		setTools(prompt?.languageModelConfig?.tools || []);
	}, [prompt?.languageModelConfig?.tools]);

	// Sync json schema from prompt
	useEffect(() => {
		if (prompt?.languageModelConfig?.json_schema) {
			const jsonSchema =
				typeof prompt.languageModelConfig.json_schema === "string"
					? prompt.languageModelConfig.json_schema
					: JSON.stringify(prompt.languageModelConfig.json_schema);
			setCurrentJsonSchema(jsonSchema);
		} else {
			setCurrentJsonSchema(null);
		}
	}, [prompt?.languageModelConfig?.json_schema]);

	return {
		// Form
		form,
		control,
		responseFormat,

		// State
		isUpdatingModel,
		isChangingModel,
		isDataReady,
		isFormValid,
		loading,
		forceRenderKey,

		// Model data
		selectedModelName,
		selectedModelId,
		currentModel,
		activeModelConfig,
		isCurrentModelReasoning,
		groupedModels,
		getResponseFormatOptions,
		excludedParams,
		promptId,

		// Tools
		tools,
		setTools,
		editingToolIdx,
		setEditingToolIdx,
		editingTool,
		setEditingTool,

		// Schema
		currentJsonSchema,
		setCurrentJsonSchema,
		currentResponseFormat,
		setCurrentResponseFormat,

		// Dialogs
		schemaDialogOpen,
		setSchemaDialogOpen,
		toolsModalOpen,
		setToolsModalOpen,

		// Handlers
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

		// Refs (for tool delete handler in component)
		isSyncingFromBackend,
		justChangedModel,

		// Helpers
		getFormValuesFromPrompt: () => getFormValuesFromPrompt(prompt),
		buildPayload: getPayload,
	};
}
