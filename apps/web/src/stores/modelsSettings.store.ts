import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type {
	ModelSettingsFormValues,
	ToolItem,
} from "@/pages/prompt/playground-tabs/playground/components/settings-block/models-settings/utils/types";

type ScopeParam = string | number | undefined | null;

const toKeyPart = (value: ScopeParam) => (value == null ? "" : String(value));
const promptScopeKey = (promptId: ScopeParam) => toKeyPart(promptId);

export type ModelsSettingsUIState = {
	schemaDialogOpen: boolean;
	toolsModalOpen: boolean;
	isUpdatingModel: boolean;
	isChangingModel: boolean;
	forceRenderKey: number;
	currentJsonSchema: string | null;
	currentResponseFormat: string;
	isSchemaCleared: boolean;
	selectedModelName: string;
	selectedModelId: number | null;
	tools: ToolItem[];
	editingToolIdx: number | null;
	editingTool: ToolItem | null;
};

export type ModelsSettingsDraft = Partial<ModelSettingsFormValues> & {
	tools?: ToolItem[];
	jsonSchema?: string | null;
	currentResponseFormat?: string;
	selectedModelId?: number | null;
	isSchemaCleared?: boolean;
};

type ModelsSettingsStoreState = {
	uiByPrompt: Record<string, ModelsSettingsUIState>;
	draftByPrompt: Record<string, ModelsSettingsDraft>;
	setUiState: (promptId: ScopeParam, value: Partial<ModelsSettingsUIState>) => void;
	getUiState: (promptId: ScopeParam) => ModelsSettingsUIState;
	setDraft: (promptId: ScopeParam, value: ModelsSettingsDraft) => void;
	getDraft: (promptId: ScopeParam) => ModelsSettingsDraft;
	clearDraft: (promptId: ScopeParam) => void;
	bumpForceRenderKey: (promptId: ScopeParam) => void;
	resetForPromptExit: (promptId: ScopeParam) => void;
};

const DEFAULT_UI_STATE: ModelsSettingsUIState = {
	schemaDialogOpen: false,
	toolsModalOpen: false,
	isUpdatingModel: false,
	isChangingModel: false,
	forceRenderKey: 0,
	currentJsonSchema: null,
	currentResponseFormat: "",
	isSchemaCleared: false,
	selectedModelName: "",
	selectedModelId: null,
	tools: [],
	editingToolIdx: null,
	editingTool: null,
};

const useModelsSettingsStore = create<ModelsSettingsStoreState>()(
	devtools(
		(set, get) => ({
			uiByPrompt: {},
			draftByPrompt: {},
			setUiState: (promptId, value) =>
				set(
					(state) => {
						const key = promptScopeKey(promptId);
						const prev = state.uiByPrompt[key] ?? DEFAULT_UI_STATE;
						return {
							uiByPrompt: {
								...state.uiByPrompt,
								[key]: {
									...prev,
									...value,
								},
							},
						};
					},
					false,
					"setUiState",
				),
			getUiState: (promptId) => {
				const key = promptScopeKey(promptId);
				return get().uiByPrompt[key] ?? DEFAULT_UI_STATE;
			},
			setDraft: (promptId, value) =>
				set(
					(state) => {
						const key = promptScopeKey(promptId);
						const prev = state.draftByPrompt[key] ?? {};
						return {
							draftByPrompt: {
								...state.draftByPrompt,
								[key]: {
									...prev,
									...value,
								},
							},
						};
					},
					false,
					"setDraft",
				),
			getDraft: (promptId) => {
				const key = promptScopeKey(promptId);
				return get().draftByPrompt[key] ?? {};
			},
			clearDraft: (promptId) =>
				set(
					(state) => {
						const key = promptScopeKey(promptId);
						const next = { ...state.draftByPrompt };
						delete next[key];
						return { draftByPrompt: next };
					},
					false,
					"clearDraft",
				),
			bumpForceRenderKey: (promptId) =>
				set(
					(state) => {
						const key = promptScopeKey(promptId);
						const prev = state.uiByPrompt[key] ?? DEFAULT_UI_STATE;
						return {
							uiByPrompt: {
								...state.uiByPrompt,
								[key]: {
									...prev,
									forceRenderKey: prev.forceRenderKey + 1,
								},
							},
						};
					},
					false,
					"bumpForceRenderKey",
				),
			resetForPromptExit: (promptId) =>
				set(
					(state) => {
						const key = promptScopeKey(promptId);
						const nextUi = { ...state.uiByPrompt };
						delete nextUi[key];
						const nextDraft = { ...state.draftByPrompt };
						delete nextDraft[key];
						return { uiByPrompt: nextUi, draftByPrompt: nextDraft };
					},
					false,
					"resetForPromptExit",
				),
		}),
		{ name: "models-settings-store", enabled: true },
	),
);

export const useModelsSettingsUI = (promptId: ScopeParam) =>
	useModelsSettingsStore(
		useShallow((state) => ({
			...state.getUiState(promptId),
		})),
	);

export const useModelsSettingsActions = () =>
	useModelsSettingsStore(
		useShallow((state) => ({
			setUiState: state.setUiState,
			getUiState: state.getUiState,
			setDraft: state.setDraft,
			getDraft: state.getDraft,
			clearDraft: state.clearDraft,
			bumpForceRenderKey: state.bumpForceRenderKey,
			resetForPromptExit: state.resetForPromptExit,
		})),
	);

export default useModelsSettingsStore;
