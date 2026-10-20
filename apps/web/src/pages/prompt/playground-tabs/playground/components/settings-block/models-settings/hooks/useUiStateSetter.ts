import { useCallback } from "react";
import type {
	ModelsSettingsUIState,
	useModelsSettingsActions,
} from "@/stores/modelsSettings.store";

export type UiStateSetter<K extends keyof ModelsSettingsUIState> = (
	value: ModelsSettingsUIState[K],
) => void;

type SetUiState = ReturnType<typeof useModelsSettingsActions>["setUiState"];

/**
 * Setter for one field of this prompt's models-settings UI state. `key` is a literal at every
 * call site, so the callback changes identity only when `promptId` or `setUiState` does.
 */
export function useUiStateSetter<K extends keyof ModelsSettingsUIState>(
	promptId: number | undefined,
	setUiState: SetUiState,
	key: K,
): UiStateSetter<K> {
	return useCallback(
		(value: ModelsSettingsUIState[K]) =>
			setUiState(promptId, { [key]: value } as Pick<ModelsSettingsUIState, K>),
		[promptId, setUiState, key],
	);
}
