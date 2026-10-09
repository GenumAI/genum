import { useEffect, useCallback } from "react";
import type { useToast } from "@/hooks/useToast";
import type { useModelsSettingsActions } from "@/stores/modelsSettings.store";
import type { PromptSettings } from "@/types/Prompt";
import type { DraftPersistence } from "./useDraftPersistence";
import type { UiStateSetter } from "./useUiStateSetter";

type ModelsSettingsActions = ReturnType<typeof useModelsSettingsActions>;

interface UseResponseFormatSettingsProps {
	prompt?: PromptSettings;
	promptId?: number;
	selectedModelId: number | null;
	currentJsonSchema: string | null;
	setCurrentJsonSchema: UiStateSetter<"currentJsonSchema">;
	setCurrentResponseFormat: UiStateSetter<"currentResponseFormat">;
	setIsSchemaCleared: UiStateSetter<"isSchemaCleared">;
	setDraft: ModelsSettingsActions["setDraft"];
	syncDraftFromForm: DraftPersistence["syncDraftFromForm"];
	persistLatestDraft: DraftPersistence["persistLatestDraft"];
	toast: ReturnType<typeof useToast>["toast"];
}

/**
 * The response format and its JSON schema: switching the format, saving a schema, and following
 * the prompt's own schema whenever it changes.
 */
export function useResponseFormatSettings({
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
}: UseResponseFormatSettingsProps) {
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

	return { handleResponseFormatChange, onSaveSchema };
}
