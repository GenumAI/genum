import { useEffect, useCallback, useMemo, useRef, type MutableRefObject } from "react";
import type { UseFormGetValues, UseFormWatch } from "react-hook-form";
import debounce from "lodash.debounce";
import type { useToast } from "@/hooks/useToast";
import type { useModelsSettingsActions } from "@/stores/modelsSettings.store";
import type { PromptSettings } from "@/types/Prompt";
import type { ResponseModelConfig } from "@/types/AIModel";
import { buildModelSettingsPayload } from "../utils/payload";
import type { ModelSettingsFormValues, ToolItem } from "../utils/types";

type ModelsSettingsActions = ReturnType<typeof useModelsSettingsActions>;

interface UseDraftPersistenceProps {
	promptId?: number;
	prompt?: PromptSettings;
	selectedModelId: number | null;
	tools: ToolItem[];
	currentJsonSchema: string | null;
	currentResponseFormat: string;
	isSchemaCleared: boolean;
	activeModelConfig: ResponseModelConfig | null | undefined;
	getValues: UseFormGetValues<ModelSettingsFormValues>;
	setDraft: ModelsSettingsActions["setDraft"];
	getDraft: ModelsSettingsActions["getDraft"];
	updateModelSettings: (
		targetPromptId: number,
		payload: Record<string, unknown>,
	) => Promise<boolean>;
	getCommitStatus: () => Promise<PromptSettings | null>;
	getModelConfig: (modelId: number) => Promise<ResponseModelConfig | null>;
	toast: ReturnType<typeof useToast>["toast"];
}

/**
 * The draft of the models settings and its write-back: every edit is merged into the store's
 * draft, and the latest draft is persisted — debounced, or at once — one save at a time.
 */
export function useDraftPersistence({
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
}: UseDraftPersistenceProps) {
	const isPersistingDraftRef = useRef(false);
	const hasQueuedDraftRef = useRef(false);

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
		// eslint-disable-next-line react-hooks/refs -- debounce only calls persistLatestDraft later
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

	return {
		syncDraftFromForm,
		persistLatestDraft,
		debouncedUpdateSettings,
		onFormChange,
		getPayload,
	};
}

export type DraftPersistence = ReturnType<typeof useDraftPersistence>;

interface UseFormChangeSubscriptionProps {
	watch: UseFormWatch<ModelSettingsFormValues>;
	isSyncingFromBackendRef: MutableRefObject<boolean>;
	onFormChange: DraftPersistence["onFormChange"];
	debouncedUpdateSettings: DraftPersistence["debouncedUpdateSettings"];
}

/**
 * Saves the draft, debounced, on a change to any form field but the model, the response format
 * and the sliders — and not while a model switch writes the backend's values into the form.
 */
export function useFormChangeSubscription({
	watch,
	isSyncingFromBackendRef,
	onFormChange,
	debouncedUpdateSettings,
}: UseFormChangeSubscriptionProps) {
	useEffect(() => {
		const subscription = watch((_, { name }) => {
			if (isSyncingFromBackendRef.current) {
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
	}, [watch, onFormChange, debouncedUpdateSettings, isSyncingFromBackendRef]);
}
