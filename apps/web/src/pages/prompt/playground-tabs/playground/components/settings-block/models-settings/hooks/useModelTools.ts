import { useEffect, useCallback, type MutableRefObject } from "react";
import type { useModelsSettingsActions } from "@/stores/modelsSettings.store";
import type { PromptSettings } from "@/types/Prompt";
import type { ToolItem } from "../utils/types";
import type { DraftPersistence } from "./useDraftPersistence";
import type { UiStateSetter } from "./useUiStateSetter";

type ModelsSettingsActions = ReturnType<typeof useModelsSettingsActions>;

interface UseModelToolsProps {
	prompt?: PromptSettings;
	promptId?: number;
	tools: ToolItem[];
	isUpdatingModel: boolean;
	setTools: UiStateSetter<"tools">;
	setDraft: ModelsSettingsActions["setDraft"];
	syncDraftFromForm: DraftPersistence["syncDraftFromForm"];
	persistLatestDraft: DraftPersistence["persistLatestDraft"];
	debouncedUpdateSettings: DraftPersistence["debouncedUpdateSettings"];
	justChangedModelRef: MutableRefObject<boolean>;
}

/**
 * The prompt's function tools: adding, editing and deleting one, and following the prompt's own
 * tools whenever they change.
 */
export function useModelTools({
	prompt,
	promptId,
	tools,
	isUpdatingModel,
	setTools,
	setDraft,
	syncDraftFromForm,
	persistLatestDraft,
	debouncedUpdateSettings,
	justChangedModelRef,
}: UseModelToolsProps) {
	const handleToolDelete = useCallback(
		async (idx: number) => {
			debouncedUpdateSettings.cancel();
			justChangedModelRef.current = true;
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
					justChangedModelRef.current = false;
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
			justChangedModelRef,
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
		const nextTools = prompt?.languageModelConfig?.tools || [];
		setTools(nextTools);
		if (promptId) {
			setDraft(promptId, { tools: nextTools });
		}
	}, [promptId, prompt?.languageModelConfig?.tools, setTools, setDraft]);

	return { handleToolDelete, handleToolSave };
}
