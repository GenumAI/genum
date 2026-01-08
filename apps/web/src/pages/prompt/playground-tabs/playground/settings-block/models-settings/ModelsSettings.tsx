import { useEffect, useCallback, useMemo, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "react-router-dom";
import { z } from "zod";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/Slider";
import { usePromptsModels } from "@/hooks/usePromptsModels";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Brain, Trash2 } from "lucide-react";
import { Info } from "phosphor-react";
import { useToast } from "@/hooks/useToast";
import debounce from "lodash.debounce";
import { Button } from "@/components/ui/button";
import SchemaEditDialog from "../../../../../../components/dialogs/SchemaEditDialog";
import type { PromptSettings } from "@/types/Prompt";
import type { Model } from "@/types/AIModel";
import { TooltipArrow } from "@radix-ui/react-tooltip";
import { useRefreshCommitStatus } from "@/hooks/useRefreshCommitStatus";
import ToolsModal from "@/components/dialogs/ToolsDialog";
import { InputSelect, InputSelectTrigger } from "@/components/ui/InputSelect";
import { usePromptStatus } from "@/contexts/PromptStatusContext";
import { promptApi } from "@/api/prompt";

const isReasoningModel = (modelName: string) => {
	return (
		modelName?.toLowerCase().includes("o3-mini") || modelName?.toLowerCase().includes("o4-mini")
	);
};

const formatPrice = (price: number) => {
	return `${price.toFixed(2)}$`;
};

const getParameterDescription = (paramKey: string) => {
	const descriptions: Record<string, string> = {
		temperature:
			"Defines how much randomness the model introduces into its responses. Lower values make responses focused and predictable, higher ones more creative but less consistent.",
		max_tokens:
			"Defines the upper limit of tokens (words + subwords) the model can generate in a single response.",
		verbosity:
			"Controls how detailed or concise the response should be, balancing brief summaries against more elaborate explanations.",
		reasoning_effort:
			"Determines how much internal computation the model dedicates to reasoning before producing an answer.",
	};

	return descriptions[paramKey] || "";
};

const getModelTooltipContent = (model: Model) => {
	const isReasoning = isReasoningModel(model.name);

	return (
		<div className="max-w-xs p-2">
			<div className="font-bold text-[14px] mb-1 text-background dark:text-white">
				{model.displayName || model.name}
			</div>

			{model.description && (
				<div className="text-[12px] text-background dark:text-white">
					{model.description}
				</div>
			)}

			<div className="text-[11px] flex flex-col gap-2.5">
				<div className="flex justify-between mt-4 items-center">
					<span className="text-background/70 dark:text-white/70">Vendor:</span>
					<span className="font-medium text-background dark:text-white">
						{model.vendor}
					</span>
				</div>

				<div className="flex justify-between gap-4 items-center">
					<span className="text-background/70 dark:text-white/70">Context:</span>
					<span className="text-background dark:text-white">
						{model.contextTokensMax?.toLocaleString()}
					</span>
				</div>

				<div className="flex justify-between gap-4 items-center">
					<span className="text-background/70 dark:text-white/70">Max tokens:</span>
					<span className="text-background dark:text-white">
						{model.completionTokensMax?.toLocaleString()}
					</span>
				</div>

				<div className="flex justify-between gap-4 items-center">
					<span className="text-background/70 dark:text-white/70">Prompt:</span>
					<span className="text-background dark:text-white">
						{formatPrice(model.promptPrice)} / 1M
					</span>
				</div>

				<div className="flex justify-between gap-4 items-center">
					<span className="text-background/70 dark:text-white/70">Completion:</span>
					<span className="text-background dark:text-white">
						{formatPrice(model.completionPrice)} / 1M
					</span>
				</div>

				{isReasoning && (
					<div className="flex flex-row items-center gap-2 text-[#6597FF] text-center mt-2">
						<Brain className="w-4" /> Reasoning Model
					</div>
				)}
			</div>
		</div>
	);
};

const modelSettingsSchema = z.object({
	selectedModel: z.string().min(1, "Please select a model"),
	selectedModelId: z.number().nullable(),
	maxTokens: z.number().nullable(),
	temperature: z.number().nullable(),
	topP: z.number().nullable(),
	frequencyPenalty: z.number().nullable(),
	presencePenalty: z.number().nullable(),
	responseFormat: z.string(),
	verbosity: z.enum(["low", "medium", "high"]).nullable().optional(),
	reasoningEffort: z
		.enum(["none", "minimal", "low", "medium", "high", "xhigh"])
		.nullable()
		.optional(),
});

type ModelSettingsFormValues = z.infer<typeof modelSettingsSchema>;

interface ModelsSettingsProps {
	models?: Model[];
	promptId?: number;
	prompt?: PromptSettings;
	onValidationChange?: (isValid: boolean) => void;
	isUpdatingPromptContent?: boolean;
}

interface FormSliderProps {
	name: keyof ModelSettingsFormValues;
	label: string;
	min: number;
	max: number;
	step: number;
	disabled?: boolean;
	control: any;
}

const FormSlider = ({ name, label, min, max, step, disabled, control }: FormSliderProps) => {
	const paramKey = name.replace(/([A-Z])/g, "_$1").toLowerCase();
	const description = getParameterDescription(paramKey);

	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => {
				const backendValue = field.value;
				let currentValue: number;

				if (backendValue !== null && backendValue !== undefined) {
					currentValue = Number(backendValue);
				} else {
					currentValue = 0;
				}

				return (
					<FormItem className="space-y-2.5">
						<div className="flex justify-between items-center">
							<div className="flex items-center gap-1">
								<FormLabel className="text-[12px]">{label}</FormLabel>
								{description && (
									<Tooltip>
										<TooltipTrigger asChild>
											<Info
												size={14}
												className="text-muted-foreground hover:text-foreground cursor-help"
											/>
										</TooltipTrigger>
										<TooltipContent className="max-w-xs">
											<p className="text-sm">{description}</p>
										</TooltipContent>
									</Tooltip>
								)}
							</div>
							<span className="text-[12px] text-muted-foreground">
								{currentValue}
							</span>
						</div>
						<FormControl>
							<Slider
								max={max}
								min={min}
								step={step}
								value={[currentValue]}
								onValueChange={(values) => {
									const newValue = values[0];
									field.onChange(newValue);
								}}
								disabled={disabled}
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				);
			}}
		/>
	);
};

function buildModelSettingsPayload({
	parameters,
	formValues,
	tools,
	responseFormat,
	jsonSchema,
	selectedModelId,
	currentResponseFormat,
	prompt,
}: {
	parameters: Record<string, any>;
	formValues: Record<string, any>;
	tools: any[];
	responseFormat: string;
	jsonSchema: string | null;
	selectedModelId: number | null;
	currentResponseFormat: string;
	prompt?: PromptSettings;
}) {
	const payload: Record<string, any> = {};

	if (parameters) {
		Object.keys(parameters).forEach((param) => {
			if (param === "response_format" || param === "json_schema") return;
			const value = formValues[param.replace(/_([a-z])/g, (_, l) => l.toUpperCase())];
			if (value !== undefined && value !== null) {
				payload[param] = value;
			}
		});
	}

	if (Array.isArray(tools)) {
		payload.tools = tools;
	}

	if (responseFormat || currentResponseFormat) {
		payload.response_format = responseFormat || currentResponseFormat;
	}

	if ((responseFormat || currentResponseFormat) === "json_schema") {
		if (jsonSchema) {
			payload.json_schema = jsonSchema;
		} else if (prompt?.languageModelConfig?.json_schema) {
			payload.json_schema =
				typeof prompt.languageModelConfig.json_schema === "string"
					? prompt.languageModelConfig.json_schema
					: JSON.stringify(prompt.languageModelConfig.json_schema);
		}
	}

	if (selectedModelId) {
		payload.languageModelId = Number(selectedModelId);
	}

	Object.keys(payload).forEach((key) => {
		if (
			payload[key] === undefined ||
			payload[key] === null ||
			(typeof payload[key] === "string" && payload[key].trim() === "")
		) {
			delete payload[key];
		}
	});

	return payload;
}

const ModelsSettings = ({
	prompt,
	models,
	promptId: propPromptId,
	onValidationChange,
	isUpdatingPromptContent,
}: ModelsSettingsProps) => {
	const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);
	const [isUpdatingModel, setIsUpdatingModel] = useState(false);
	const [forceRenderKey, setForceRenderKey] = useState(0);
	const [currentModelConfig, setCurrentModelConfig] = useState<any>(null);
	const [currentJsonSchema, setCurrentJsonSchema] = useState<string | null>(null);
	const [currentResponseFormat, setCurrentResponseFormat] = useState<string>("");
	const [selectedModelName, setSelectedModelName] = useState<string>("");
	const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
	const [isChangingModel, setIsChangingModel] = useState(false);
	const [toolsModalOpen, setToolsModalOpen] = useState(false);
	const [tools, setTools] = useState(prompt?.languageModelConfig?.tools || []);
	const [editingToolIdx, setEditingToolIdx] = useState<number | null>(null);
	const [editingTool, setEditingTool] = useState<any>(null);

	const userSelectionInProgress = useRef<boolean>(false);
	const isInitialized = useRef<boolean>(false);
	const justChangedModel = useRef<boolean>(false);
	const isSyncingFromBackend = useRef(false);

	const { getModelConfig, modelConfig, updateModelSettings, updatePromptModel, loading } =
		usePromptsModels();
	const { toast } = useToast();
	const { id } = useParams<{ id: string; orgId: string; projectId: string }>();

	const { setIsCommitted } = usePromptStatus();

	const promptId = prompt?.id || (id ? Number(id) : propPromptId);

	const getFormValuesFromPrompt = useCallback((prompt?: PromptSettings) => {
		if (!prompt || !prompt.languageModel?.name || !prompt.languageModel?.id) {
			return {
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
			};
		}

		const config = prompt.languageModelConfig;

		return {
			selectedModel: prompt.languageModel.name,
			selectedModelId: prompt.languageModel.id,
			maxTokens: config?.max_tokens ?? 0,
			temperature: config?.temperature ?? 0,
			topP: config?.top_p ?? 0,
			frequencyPenalty: config?.frequency_penalty ?? 0,
			presencePenalty: config?.presence_penalty ?? 0,
			responseFormat: config?.response_format || "",
			reasoningEffort: config?.reasoning_effort || null,
			verbosity: config?.verbosity ?? null,
		};
	}, []);

	const form = useForm<ModelSettingsFormValues>({
		resolver: zodResolver(modelSettingsSchema as any),
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

	const currentModel = models?.find((model) => model.name === selectedModelName);
	const isCurrentModelReasoning = Boolean(
		(currentModelConfig || modelConfig)?.parameters?.reasoning_effort,
	);

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
		return models.reduce(
			(groups, model) => {
				const vendor = model.vendor?.toUpperCase() || "OTHER";
				if (!groups[vendor]) groups[vendor] = [];
				groups[vendor].push(model);
				return groups;
			},
			{} as Record<string, Model[]>,
		);
	}, [models]);

	const activeModelConfig = currentModelConfig || modelConfig;

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

	const debouncedUpdateSettings = useMemo(
		() =>
			debounce(async () => {
				if (isUpdatingModel || !selectedModelId || justChangedModel.current) {
					return;
				}

				const formValues = getValues();
				const payload = buildModelSettingsPayload({
					parameters: activeModelConfig?.parameters || {},
					formValues,
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
			selectedModelName,
			currentModel,
			getCommitStatus,
			toast,
			getValues,
			promptId,
			currentJsonSchema,
			currentResponseFormat,
			tools,
			activeModelConfig,
			prompt,
		],
	);

	const onFormChange = useCallback(() => {
		if (isSyncingFromBackend.current) return;
		if (promptId && selectedModelId && !isUpdatingModel && !justChangedModel.current) {
			debouncedUpdateSettings();
		}
	}, [promptId, selectedModelId, debouncedUpdateSettings, isUpdatingModel]);

	const refreshCommitStatus = useRefreshCommitStatus(promptId, setIsCommitted);

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
								(configResponse as any)?.parameters?.response_format?.default ||
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

						if (
							backendConfig.max_tokens !== undefined &&
							backendConfig.max_tokens !== null
						) {
							setValue("maxTokens", backendConfig.max_tokens, {
								shouldValidate: false,
							});
						} else {
							setValue("maxTokens", null, { shouldValidate: false });
						}

						if (
							backendConfig.temperature !== undefined &&
							backendConfig.temperature !== null
						) {
							setValue("temperature", backendConfig.temperature, {
								shouldValidate: false,
							});
						} else {
							setValue("temperature", null, { shouldValidate: false });
						}

						if (backendConfig.top_p !== undefined && backendConfig.top_p !== null) {
							setValue("topP", backendConfig.top_p, { shouldValidate: false });
						} else {
							setValue("topP", null, { shouldValidate: false });
						}

						if (
							backendConfig.frequency_penalty !== undefined &&
							backendConfig.frequency_penalty !== null
						) {
							setValue("frequencyPenalty", backendConfig.frequency_penalty, {
								shouldValidate: false,
							});
						} else {
							setValue("frequencyPenalty", null, { shouldValidate: false });
						}

						if (
							backendConfig.presence_penalty !== undefined &&
							backendConfig.presence_penalty !== null
						) {
							setValue("presencePenalty", backendConfig.presence_penalty, {
								shouldValidate: false,
							});
						} else {
							setValue("presencePenalty", null, { shouldValidate: false });
						}

						if (
							backendConfig.reasoning_effort !== undefined &&
							backendConfig.reasoning_effort !== null
						) {
							setValue("reasoningEffort", backendConfig.reasoning_effort, {
								shouldValidate: false,
							});
						} else {
							setValue("reasoningEffort", null, { shouldValidate: false });
						}

						if (
							backendConfig.verbosity !== undefined &&
							backendConfig.verbosity !== null
						) {
							setValue("verbosity", backendConfig.verbosity, {
								shouldValidate: false,
							});
						} else {
							setValue("verbosity", null, { shouldValidate: false });
						}
					} else {
						const defaultResponseFormat = String(
							(configResponse as any)?.parameters?.response_format?.default || "text",
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
			prompt?.languageModelConfig,
			prompt?.languageModel?.id,
			getFormValuesFromPrompt,
		],
	);

	const handleResponseFormatChange = useCallback(
		async (value: string) => {
			if (!selectedModelId || isUpdatingModel) {
				return;
			}
			try {
				const formValues = getValues();
				const payload = buildModelSettingsPayload({
					parameters: activeModelConfig?.parameters || {},
					formValues,
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
		],
	);

	const onSaveSchema = useCallback(
		async (data: any) => {
			if (promptId) {
				try {
					const jsonSchemaString = data.json_schema;
					setCurrentJsonSchema(jsonSchemaString);
					setCurrentResponseFormat("json_schema");
					const formValues = getValues();
					const payload = buildModelSettingsPayload({
						parameters: activeModelConfig?.parameters || {},
						formValues,
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
		prompt?.languageModel?.id,
		prompt?.languageModel?.name,
		models,
		isUpdatingModel,
		getFormValuesFromPrompt,
		setValue,
		selectedModelName,
		selectedModelId,
		isUpdatingPromptContent,
		reset,
	]);

	useEffect(() => {
		const loadModelConfig = async () => {
			if (selectedModelId && !isUpdatingModel && !justChangedModel.current) {
				try {
					const config = await getModelConfig(selectedModelId);
					setCurrentModelConfig(config);
				} catch (error) {
					console.error("Failed to load model config:", error);
					setCurrentModelConfig(null);
				}
			}
		};

		loadModelConfig();
	}, [selectedModelId, getModelConfig, isUpdatingModel]);

	useEffect(() => {
		onValidationChange?.(isFormValid);
	}, [isFormValid, onValidationChange]);

	useEffect(() => {
		const subscription = watch((value, { name }) => {
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

	useEffect(() => {
		if (!prompt?.languageModel) {
			return;
		}

		if (
			!isUpdatingModel &&
			prompt?.languageModelConfig &&
			selectedModelId &&
			!justChangedModel.current
		) {
			isSyncingFromBackend.current = true;
			const newFormValues = getFormValuesFromPrompt(prompt);
			Object.entries(newFormValues).forEach(([key, value]) => {
				if (key !== "selectedModel" && key !== "selectedModelId") {
					const currentValue = getValues(key as any);

					if (currentValue !== value) {
						setValue(key as any, value, { shouldValidate: false });
					}
				}
			});
			setTimeout(() => {
				isSyncingFromBackend.current = false;
			}, 0);
		}
	}, [
		prompt?.languageModelConfig,
		isUpdatingModel,
		selectedModelId,
		getFormValuesFromPrompt,
		setValue,
		getValues,
		prompt?.languageModel,
	]);

	useEffect(() => {
		if (
			!activeModelConfig ||
			isUpdatingModel ||
			!isInitialized.current ||
			isSyncingFromBackend.current
		)
			return;

		isSyncingFromBackend.current = true;

		const minTokens = activeModelConfig?.parameters.max_tokens?.min || 1;
		const maxTokens =
			activeModelConfig?.parameters.max_tokens?.max ||
			currentModel?.completionTokensMax ||
			4000;
		const currentTokens = getValues("maxTokens");
		if (currentTokens !== null && currentTokens > maxTokens)
			setValue("maxTokens", maxTokens, { shouldValidate: true });
		if (currentTokens !== null && currentTokens < minTokens)
			setValue("maxTokens", minTokens, { shouldValidate: true });

		const minTemp = activeModelConfig?.parameters.temperature?.min ?? 0;
		const maxTemp = activeModelConfig?.parameters.temperature?.max ?? 2;
		const currentTemp = getValues("temperature");
		if (currentTemp !== null && currentTemp > maxTemp)
			setValue("temperature", maxTemp, { shouldValidate: true });
		if (currentTemp !== null && currentTemp < minTemp)
			setValue("temperature", minTemp, { shouldValidate: true });

		const minTopP = activeModelConfig?.parameters.top_p?.min ?? 0;
		const maxTopP = activeModelConfig?.parameters.top_p?.max ?? 1;
		const currentTopP = getValues("topP");
		if (currentTopP !== null && currentTopP > maxTopP)
			setValue("topP", maxTopP, { shouldValidate: true });
		if (currentTopP !== null && currentTopP < minTopP)
			setValue("topP", minTopP, { shouldValidate: true });

		const minFreq = activeModelConfig?.parameters.frequency_penalty?.min ?? 0;
		const maxFreq = activeModelConfig?.parameters.frequency_penalty?.max ?? 2;
		const currentFreq = getValues("frequencyPenalty");
		if (currentFreq !== null && currentFreq > maxFreq)
			setValue("frequencyPenalty", maxFreq, { shouldValidate: true });
		if (currentFreq !== null && currentFreq < minFreq)
			setValue("frequencyPenalty", minFreq, { shouldValidate: true });

		const minPres = activeModelConfig?.parameters.presence_penalty?.min ?? 0;
		const maxPres = activeModelConfig?.parameters.presence_penalty?.max ?? 2;
		const currentPres = getValues("presencePenalty");
		if (currentPres !== null && currentPres > maxPres)
			setValue("presencePenalty", maxPres, { shouldValidate: true });
		if (currentPres !== null && currentPres < minPres)
			setValue("presencePenalty", minPres, { shouldValidate: true });

		setTimeout(() => {
			isSyncingFromBackend.current = false;
		}, 0);
	}, [
		selectedModelId,
		activeModelConfig,
		currentModel,
		setValue,
		getValues,
		isUpdatingModel,
		isInitialized.current,
		isSyncingFromBackend.current,
	]);

	useEffect(() => {
		setTools(prompt?.languageModelConfig?.tools || []);
	}, [prompt?.languageModelConfig?.tools]);

	if (!models || models.length === 0) {
		return (
			<div className="flex flex-col gap-2">
				<div className="text-sm text-muted-foreground">Loading models...</div>
			</div>
		);
	}

	if (!isDataReady) {
		return (
			<div className="flex flex-col gap-2">
				<div className="text-sm text-muted-foreground">Loading configuration...</div>
			</div>
		);
	}

	return (
		<TooltipProvider>
			<Form {...form}>
				<form className="flex flex-col gap-2">
					<div className="flex flex-col gap-2">
						<FormField
							control={control}
							name="selectedModel"
							render={() => (
								<FormItem className="space-y-2">
									<FormLabel className="text-[14px] flex items-center gap-1">
										Model
									</FormLabel>
									<InputSelect
										value={selectedModelName}
										onValueChange={handleModelChange}
										disabled={isUpdatingModel || loading}
										groups={Object.entries(groupedModels).map(
											([vendor, vendorModels]) => {
												const sorted = [...vendorModels].sort((a, b) => {
													const nameA = a.displayName || a.name;
													const nameB = b.displayName || b.name;
													return nameA.localeCompare(nameB, undefined, {
														sensitivity: "base",
													});
												});
												return {
													label:
														vendor === "OPENAI"
															? "OpenAI"
															: vendor.charAt(0) +
																vendor.slice(1).toLowerCase(),
													options: sorted.map((model) => ({
														value: model.name,
														label: model.displayName || model.name,
													})),
												};
											},
										)}
										placeholder="Select a model to continue"
										className={`mt-1 text-[14px] ${!selectedModelName ? "border-red-500" : ""}`}
										popoverProps={{
											side: "bottom",
											avoidCollisions: false,
											sideOffset: 4,
											align: "start",
										}}
										renderOption={({ option, isSelected, onSelect }) => {
											const model = models?.find(
												(m) => m.name === option.value,
											);
											const label =
												option.label && option.label.length > 40
													? option.label.slice(0, 40) + "…"
													: option.label;
											return (
												<Tooltip key={option.value}>
													<TooltipTrigger asChild>
														<div
															onClick={onSelect}
															className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted"
															role="option"
															aria-selected={isSelected}
														>
															<span>{label}</span>
														</div>
													</TooltipTrigger>
													{model && (
														<TooltipContent side="right" align="start">
															<TooltipArrow></TooltipArrow>
															{getModelTooltipContent(model)}
														</TooltipContent>
													)}
												</Tooltip>
											);
										}}
									>
										{({
											options,
											placeholder,
											disabled,
											selectedValue,
											setIsPopoverOpen,
										}) => (
											<InputSelectTrigger
												options={options}
												placeholder={placeholder}
												disabled={disabled}
												selectedValue={selectedValue}
												setIsPopoverOpen={setIsPopoverOpen}
												className={`mt-1 text-[14px] dark:border-[#3C3D3F] h-9 ${!selectedModelName ? "border-red-500" : ""}`}
											/>
										)}
									</InputSelect>
									<FormMessage />
									{!selectedModelName && (
										<p className="text-[12px] text-red-500">
											Please select a model before running the prompt
										</p>
									)}
								</FormItem>
							)}
						/>

						{activeModelConfig?.parameters?.response_format && (
							<FormField
								control={control}
								name="responseFormat"
								render={({ field }) => (
									<FormItem className="space-y-2">
										<FormLabel className="text-[14px]">
											Response Format
										</FormLabel>
										<Select
											value={field.value || ""}
											onValueChange={(value) => {
												field.onChange(value);
												handleResponseFormatChange(value);
											}}
											disabled={isUpdatingModel || loading}
										>
											<FormControl>
												<SelectTrigger
													id="response-format"
													className="mt-1 text-[14px] dark:bg-transparent dark:border-[#3C3D3F]"
												>
													<SelectValue placeholder={field.value} />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{getResponseFormatOptions.map((format: string) => (
													<SelectItem key={format} value={format}>
														{format}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						{responseFormat === "json_schema" && (
							<Button
								variant="secondary"
								size="sm"
								className="w-full self-start px-1 py-1 gap-1 transition-colors mt-2"
								type="button"
								onClick={() => setSchemaDialogOpen(true)}
								disabled={isUpdatingModel || loading}
							>
								Edit Schema
							</Button>
						)}

						<div className="flex flex-col mt-2 gap-2">
							<span className="text-[14px] font-medium leading-none">Tools</span>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								className="w-full self-start px-1 py-1 gap-1 transition-colors"
								onClick={() => setToolsModalOpen(true)}
							>
								Add Function
							</Button>
							<div className="rounded-lg bg-trasparent mt-2 flex flex-col items-center justify-center">
								{Array.isArray(tools) && tools.length > 0 && (
									<div className="w-full flex flex-col gap-2">
										{tools.map((tool: any, idx: number) => (
											<div
												key={tool.name + idx}
												className="flex items-center justify-between px-3 py-2 mt-1 border rounded-lg hover:bg-muted h-9 cursor-pointer transition-colors"
												onClick={(e) => {
													e.preventDefault();
													setEditingToolIdx(idx);
													setEditingTool(tool);
													setToolsModalOpen(true);
												}}
											>
												<span className="text-[14px]" title={tool.name}>
													{tool.name.length > 20
														? tool.name.slice(0, 20) + "…"
														: tool.name}
												</span>
												<Button
													variant="ghost"
													size="icon"
													className="w-7 h-7 text-foreground hover:text-red-600 transition-colors"
													onClick={async (e) => {
														e.stopPropagation();
														debouncedUpdateSettings.cancel();
														justChangedModel.current = true;
														if (isUpdatingModel) return;
														setIsUpdatingModel(true);
														try {
															const updatedTools = tools.filter(
																(t: any, i: number) => i !== idx,
															);
															setTools(updatedTools);
															const formValues = getValues();
															const payload =
																buildModelSettingsPayload({
																	parameters:
																		activeModelConfig?.parameters ||
																		{},
																	formValues,
																	tools: updatedTools,
																	responseFormat:
																		formValues.responseFormat ||
																		currentResponseFormat,
																	jsonSchema: currentJsonSchema,
																	selectedModelId,
																	currentResponseFormat,
																	prompt,
																});
															await updateModelSettings(
																promptId as number,
																payload,
															);
															const updatedPrompt = await getCommitStatus();
															if (selectedModelId) {
																await getModelConfig(
																	selectedModelId,
																);
															}

															await new Promise((resolve) =>
																setTimeout(resolve, 100),
															);

															isSyncingFromBackend.current = true;
															if (
																updatedPrompt?.languageModelConfig &&
																updatedPrompt?.languageModel
															) {
																const backendFormValues =
																	getFormValuesFromPrompt(
																		updatedPrompt,
																	);
																Object.entries(
																	backendFormValues,
																).forEach(([key, value]) => {
																	setValue(key as any, value, {
																		shouldValidate: false,
																	});
																});

																setSelectedModelName(
																	updatedPrompt.languageModel
																		.name,
																);
																setSelectedModelId(
																	updatedPrompt.languageModel.id,
																);
															}
															setTimeout(() => {
																isSyncingFromBackend.current = false;
															}, 100);
														} catch (error) {
															toast({
																title: "Error",
																description:
																	"Failed to delete tool",
																variant: "destructive",
															});
														} finally {
															setIsUpdatingModel(false);
															setTimeout(() => {
																justChangedModel.current = false;
															}, 1000);
														}
													}}
												>
													<Trash2 className="w-4 h-4" />
												</Button>
											</div>
										))}
									</div>
								)}
							</div>
							<ToolsModal
								open={toolsModalOpen}
								onOpenChange={(open) => {
									setToolsModalOpen(open);
									if (!open) {
										setEditingToolIdx(null);
										setEditingTool(null);
									}
								}}
								llmConfig={prompt?.languageModelConfig}
								promptId={promptId}
								tools={tools}
								setTools={async (newTools: any[]) => {
									if (editingToolIdx !== null && editingToolIdx >= 0) {
										const updatedTools = tools.map((t: any, i: number) =>
											i === editingToolIdx ? newTools[0] : t,
										);
										const formValues = getValues();
										const payload = buildModelSettingsPayload({
											parameters: activeModelConfig?.parameters || {},
											formValues,
											tools: updatedTools,
											responseFormat:
												formValues.responseFormat || currentResponseFormat,
											jsonSchema: currentJsonSchema,
											selectedModelId,
											currentResponseFormat,
											prompt,
										});
										await updateModelSettings(promptId as number, payload);
										setTools(updatedTools);
										const updatedPrompt = await getCommitStatus();
										if (selectedModelId) {
											await getModelConfig(selectedModelId);
										}

										await new Promise((resolve) => setTimeout(resolve, 100));

										isSyncingFromBackend.current = true;
										if (
											updatedPrompt?.languageModelConfig &&
											updatedPrompt?.languageModel
										) {
											const backendFormValues =
												getFormValuesFromPrompt(updatedPrompt);
											Object.entries(backendFormValues).forEach(
												([key, value]) => {
													setValue(key as any, value, {
														shouldValidate: false,
													});
												},
											);

											setSelectedModelName(updatedPrompt.languageModel.name);
											setSelectedModelId(updatedPrompt.languageModel.id);
										}
										setTimeout(() => {
											isSyncingFromBackend.current = false;
										}, 100);
									} else {
										const formValues = getValues();
										const updatedTools = [...tools, ...newTools];
										const payload = buildModelSettingsPayload({
											parameters: activeModelConfig?.parameters || {},
											formValues,
											tools: updatedTools,
											responseFormat:
												formValues.responseFormat || currentResponseFormat,
											jsonSchema: currentJsonSchema,
											selectedModelId,
											currentResponseFormat,
											prompt,
										});
										await updateModelSettings(promptId as number, payload);
										setTools(updatedTools);
										const updatedPrompt = await getCommitStatus();
										if (selectedModelId) {
											await getModelConfig(selectedModelId);
										}

										await new Promise((resolve) => setTimeout(resolve, 100));

										isSyncingFromBackend.current = true;
										if (
											updatedPrompt?.languageModelConfig &&
											updatedPrompt?.languageModel
										) {
											const backendFormValues =
												getFormValuesFromPrompt(updatedPrompt);
											Object.entries(backendFormValues).forEach(
												([key, value]) => {
													setValue(key as any, value, {
														shouldValidate: false,
													});
												},
											);

											setSelectedModelName(updatedPrompt.languageModel.name);
											setSelectedModelId(updatedPrompt.languageModel.id);
										}
										setTimeout(() => {
											isSyncingFromBackend.current = false;
										}, 100);
									}
									setEditingToolIdx(null);
									setEditingTool(null);
								}}
								editingTool={editingTool}
							/>
						</div>
					</div>

					<div key={`${forceRenderKey}-${selectedModelId}`} className="space-y-5 mt-2">
						{isCurrentModelReasoning && (
							<FormField
								control={control}
								name="reasoningEffort"
								render={({ field }) => (
									<FormItem className="space-y-2">
										<div className="flex items-center gap-1">
											<FormLabel>Reasoning Effort</FormLabel>
											<Tooltip>
												<TooltipTrigger asChild>
													<Info
														size={14}
														className="text-muted-foreground hover:text-foreground cursor-help"
													/>
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<p className="text-sm">
														{getParameterDescription(
															"reasoning_effort",
														)}
													</p>
												</TooltipContent>
											</Tooltip>
										</div>
										<Select
											value={field.value || ""}
											onValueChange={(value) => {
												field.onChange(value);
												onFormChange();
											}}
											disabled={isUpdatingModel || loading}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select reasoning effort" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{(
													activeModelConfig?.parameters?.reasoning_effort
														?.allowed || [
														"none",
														"minimal",
														"low",
														"medium",
														"high",
														"xhigh",
													]
												).map((opt: string) => (
													<SelectItem key={opt} value={opt}>
														{opt}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						<>
							{Object.entries(activeModelConfig?.parameters || {}).map(
								([paramKey, paramCfg]: any) => {
									if (excludedParams.includes(paramKey)) return null;

									const camelName = paramKey.replace(
										/_([a-z])/g,
										(_match: string, letter: string) => letter.toUpperCase(),
									);

									if (paramCfg?.allowed && Array.isArray(paramCfg.allowed)) {
										return (
											<FormField
												key={paramKey}
												control={control}
												name={camelName as any}
												render={({ field }) => {
													const description =
														getParameterDescription(paramKey);

													return (
														<FormItem className="space-y-2">
															<div className="flex items-center gap-1">
																<FormLabel className="text-[14px] capitalize">
																	{paramKey.replace(/_/g, " ")}
																</FormLabel>
																{description && (
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<Info
																				size={14}
																				className="text-muted-foreground hover:text-foreground cursor-help"
																			/>
																		</TooltipTrigger>
																		<TooltipContent className="max-w-xs">
																			<p className="text-sm">
																				{description}
																			</p>
																		</TooltipContent>
																	</Tooltip>
																)}
															</div>
															<Select
																value={
																	field.value?.toString() || ""
																}
																onValueChange={(value) => {
																	field.onChange(value);
																	onFormChange();
																}}
																disabled={
																	isUpdatingModel || loading
																}
															>
																<FormControl>
																	<SelectTrigger>
																		<SelectValue
																			placeholder={`Select ${paramKey.replace(/_/g, " ")}`}
																		/>
																	</SelectTrigger>
																</FormControl>
																<SelectContent>
																	{paramCfg.allowed.map(
																		(option: string) => (
																			<SelectItem
																				key={option}
																				value={option}
																			>
																				{option}
																			</SelectItem>
																		),
																	)}
																</SelectContent>
															</Select>
															<FormMessage />
														</FormItem>
													);
												}}
											/>
										);
									}

									if (
										paramCfg?.min !== undefined &&
										paramCfg?.max !== undefined
									) {
										const isMaxTokens = paramKey === "max_tokens";
										const isNumeric = [
											"frequency_penalty",
											"presence_penalty",
											"top_p",
											"temperature",
										].includes(paramKey);
										const step = isMaxTokens ? 1 : isNumeric ? 0.01 : 1;

										return (
											<FormField
												key={paramKey}
												control={control}
												name={camelName as any}
												render={({ field }) => {
													const currentValue =
														field.value ?? paramCfg?.default ?? 0;

													const description =
														getParameterDescription(paramKey);

													return (
														<FormItem className="space-y-2.5">
															<div className="flex justify-between items-center">
																<div className="flex items-center gap-1">
																	<FormLabel className="text-[12px] capitalize">
																		{paramKey.replace(
																			/_/g,
																			" ",
																		)}
																	</FormLabel>
																	{description && (
																		<Tooltip>
																			<TooltipTrigger asChild>
																				<Info
																					size={14}
																					className="text-muted-foreground hover:text-foreground cursor-help"
																				/>
																			</TooltipTrigger>
																			<TooltipContent className="max-w-xs">
																				<p className="text-sm">
																					{description}
																				</p>
																			</TooltipContent>
																		</Tooltip>
																	)}
																</div>
																<span className="text-[12px] text-muted-foreground">
																	{currentValue}
																</span>
															</div>
															<FormControl>
																<Slider
																	max={paramCfg.max}
																	min={paramCfg.min}
																	step={step}
																	value={[Number(currentValue)]}
																	onValueChange={(values) => {
																		const newValue = values[0];
																		field.onChange(newValue);
																	}}
																	disabled={
																		isUpdatingModel || loading
																	}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													);
												}}
											/>
										);
									}

									return null;
								},
							)}
						</>
					</div>
				</form>

				{responseFormat === "json_schema" && !!prompt && (
					<SchemaEditDialog
						open={schemaDialogOpen}
						setOpen={setSchemaDialogOpen}
						promptId={promptId}
						modelParameters={prompt.languageModelConfig}
						onSave={onSaveSchema}
					/>
				)}
			</Form>
		</TooltipProvider>
	);
};

export default ModelsSettings;
