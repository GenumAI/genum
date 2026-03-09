import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { PromptResponse } from "@/api/prompt";

export type MemorySelectionState = {
	selectedMemoryId: string;
	selectedMemoryKeyName: string;
};

export type PageHeaderUiState = {
	isEditing: boolean;
	editableTitle: string;
	modalOpen: boolean;
	isUpdating: boolean;
};

type ScopeParam = string | number | undefined | null;

const toKeyPart = (value: ScopeParam) => (value == null ? "" : String(value));
const draftScopeKey = (promptId: ScopeParam, testcaseId: ScopeParam) =>
	`${toKeyPart(promptId)}::${toKeyPart(testcaseId)}`;
const memoryValueScopeKey = (promptId: ScopeParam, testcaseId: ScopeParam, memoryId: ScopeParam) =>
	`${toKeyPart(promptId)}::${toKeyPart(testcaseId)}::${toKeyPart(memoryId)}`;

type PlaygroundSessionDraft = {
	runLoading: boolean;
	wasRun: boolean;
	isTestcaseLoaded: boolean;
	status: string;
};

interface PlaygroundDraftData {
	inputDrafts: Record<string, string>;
	outputDrafts: Record<string, PromptResponse | null>;
	expectedOutputDrafts: Record<string, PromptResponse | null>;
	expectedThoughtsDrafts: Record<string, string>;
	sessionDrafts: Record<string, PlaygroundSessionDraft>;
	memorySelectionDrafts: Record<string, MemorySelectionState>;
	memoryValueDrafts: Record<string, string>;
	pageHeaderUi: PageHeaderUiState;
}

interface PlaygroundDraftActions {
	setInputDraft: (promptId: ScopeParam, testcaseId: ScopeParam, value: string) => void;
	getInputDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => string;
	clearInputDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => void;

	setOutputDraft: (
		promptId: ScopeParam,
		testcaseId: ScopeParam,
		value: PromptResponse | null,
	) => void;
	getOutputDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => PromptResponse | null;

	setExpectedOutputDraft: (
		promptId: ScopeParam,
		testcaseId: ScopeParam,
		value: PromptResponse | null,
	) => void;
	getExpectedOutputDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => PromptResponse | null;

	setExpectedThoughtsDraft: (promptId: ScopeParam, testcaseId: ScopeParam, value: string) => void;
	getExpectedThoughtsDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => string;

	clearOutputDrafts: (promptId: ScopeParam, testcaseId: ScopeParam) => void;

	setSessionDraft: (
		promptId: ScopeParam,
		testcaseId: ScopeParam,
		updater: (prev: PlaygroundSessionDraft) => PlaygroundSessionDraft,
	) => void;
	getSessionDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => PlaygroundSessionDraft;
	clearSessionDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => void;

	setMemorySelectionDraft: (
		promptId: ScopeParam,
		testcaseId: ScopeParam,
		value: Partial<MemorySelectionState>,
	) => void;
	getMemorySelectionDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => MemorySelectionState;

	setMemoryValueDraft: (
		promptId: ScopeParam,
		testcaseId: ScopeParam,
		memoryId: ScopeParam,
		value: string,
	) => void;
	getMemoryValueDraft: (
		promptId: ScopeParam,
		testcaseId: ScopeParam,
		memoryId: ScopeParam,
	) => string;
	clearMemoryValueDraft: (promptId: ScopeParam, testcaseId: ScopeParam, memoryId: ScopeParam) => void;

	resetForTestcaseExit: (promptId: ScopeParam, prevTestcaseId: ScopeParam) => void;
	resetAfterAddTestcase: (promptId: ScopeParam) => void;
	resetForPromptExit: (promptId: ScopeParam, testcaseId: ScopeParam) => void;

	setPageHeaderUi: (value: Partial<PageHeaderUiState>) => void;
	resetPageHeaderUi: () => void;
}

type PlaygroundState = PlaygroundDraftData & PlaygroundDraftActions;

const DEFAULT_MEMORY_SELECTION: MemorySelectionState = {
	selectedMemoryId: "",
	selectedMemoryKeyName: "",
};

const DEFAULT_SESSION_DRAFT: PlaygroundSessionDraft = {
	runLoading: false,
	wasRun: false,
	isTestcaseLoaded: false,
	status: "",
};

const DEFAULT_PAGE_HEADER_UI: PageHeaderUiState = {
	isEditing: false,
	editableTitle: "",
	modalOpen: false,
	isUpdating: false,
};

const initialState: PlaygroundDraftData = {
	inputDrafts: {},
	outputDrafts: {},
	expectedOutputDrafts: {},
	expectedThoughtsDrafts: {},
	sessionDrafts: {},
	memorySelectionDrafts: {},
	memoryValueDrafts: {},
	pageHeaderUi: DEFAULT_PAGE_HEADER_UI,
};

const usePlaygroundStore = create<PlaygroundState>()(
	devtools(
		(set, get) => ({
			...initialState,

			setInputDraft: (promptId, testcaseId, value) =>
				set(
					(state) => ({
						inputDrafts: {
							...state.inputDrafts,
							[draftScopeKey(promptId, testcaseId)]: value,
						},
					}),
					false,
					"setInputDraft",
				),
			getInputDraft: (promptId, testcaseId) =>
				get().inputDrafts[draftScopeKey(promptId, testcaseId)] ?? "",
			clearInputDraft: (promptId, testcaseId) =>
				set(
					(state) => {
						const key = draftScopeKey(promptId, testcaseId);
						const next = { ...state.inputDrafts };
						delete next[key];
						return { inputDrafts: next };
					},
					false,
					"clearInputDraft",
				),

			setOutputDraft: (promptId, testcaseId, value) =>
				set(
					(state) => ({
						outputDrafts: {
							...state.outputDrafts,
							[draftScopeKey(promptId, testcaseId)]: value,
						},
					}),
					false,
					"setOutputDraft",
				),
			getOutputDraft: (promptId, testcaseId) =>
				get().outputDrafts[draftScopeKey(promptId, testcaseId)] ?? null,

			setExpectedOutputDraft: (promptId, testcaseId, value) =>
				set(
					(state) => ({
						expectedOutputDrafts: {
							...state.expectedOutputDrafts,
							[draftScopeKey(promptId, testcaseId)]: value,
						},
					}),
					false,
					"setExpectedOutputDraft",
				),
			getExpectedOutputDraft: (promptId, testcaseId) =>
				get().expectedOutputDrafts[draftScopeKey(promptId, testcaseId)] ?? null,

			setExpectedThoughtsDraft: (promptId, testcaseId, value) =>
				set(
					(state) => ({
						expectedThoughtsDrafts: {
							...state.expectedThoughtsDrafts,
							[draftScopeKey(promptId, testcaseId)]: value,
						},
					}),
					false,
					"setExpectedThoughtsDraft",
				),
			getExpectedThoughtsDraft: (promptId, testcaseId) =>
				get().expectedThoughtsDrafts[draftScopeKey(promptId, testcaseId)] ?? "",

			clearOutputDrafts: (promptId, testcaseId) =>
				set(
					(state) => {
						const key = draftScopeKey(promptId, testcaseId);
						const outputDrafts = { ...state.outputDrafts };
						delete outputDrafts[key];
						const expectedOutputDrafts = { ...state.expectedOutputDrafts };
						delete expectedOutputDrafts[key];
						const expectedThoughtsDrafts = { ...state.expectedThoughtsDrafts };
						delete expectedThoughtsDrafts[key];
						return {
							outputDrafts,
							expectedOutputDrafts,
							expectedThoughtsDrafts,
						};
					},
					false,
					"clearOutputDrafts",
				),

			setSessionDraft: (promptId, testcaseId, updater) =>
				set(
					(state) => {
						const key = draftScopeKey(promptId, testcaseId);
						const prev = state.sessionDrafts[key] ?? DEFAULT_SESSION_DRAFT;
						return {
							sessionDrafts: {
								...state.sessionDrafts,
								[key]: updater(prev),
							},
						};
					},
					false,
					"setSessionDraft",
				),
			getSessionDraft: (promptId, testcaseId) =>
				get().sessionDrafts[draftScopeKey(promptId, testcaseId)] ?? DEFAULT_SESSION_DRAFT,
			clearSessionDraft: (promptId, testcaseId) =>
				set(
					(state) => {
						const key = draftScopeKey(promptId, testcaseId);
						const next = { ...state.sessionDrafts };
						delete next[key];
						return { sessionDrafts: next };
					},
					false,
					"clearSessionDraft",
				),

			setMemorySelectionDraft: (promptId, testcaseId, value) =>
				set(
					(state) => {
						const key = draftScopeKey(promptId, testcaseId);
						const prev = state.memorySelectionDrafts[key] ?? DEFAULT_MEMORY_SELECTION;
						return {
							memorySelectionDrafts: {
								...state.memorySelectionDrafts,
								[key]: { ...prev, ...value },
							},
						};
					},
					false,
					"setMemorySelectionDraft",
				),
			getMemorySelectionDraft: (promptId, testcaseId) =>
				get().memorySelectionDrafts[draftScopeKey(promptId, testcaseId)] ??
				DEFAULT_MEMORY_SELECTION,

			setMemoryValueDraft: (promptId, testcaseId, memoryId, value) =>
				set(
					(state) => ({
						memoryValueDrafts: {
							...state.memoryValueDrafts,
							[memoryValueScopeKey(promptId, testcaseId, memoryId)]: value,
						},
					}),
					false,
					"setMemoryValueDraft",
				),
			getMemoryValueDraft: (promptId, testcaseId, memoryId) =>
				get().memoryValueDrafts[memoryValueScopeKey(promptId, testcaseId, memoryId)] ?? "",
			clearMemoryValueDraft: (promptId, testcaseId, memoryId) =>
				set(
					(state) => {
						const key = memoryValueScopeKey(promptId, testcaseId, memoryId);
						const next = { ...state.memoryValueDrafts };
						delete next[key];
						return { memoryValueDrafts: next };
					},
					false,
					"clearMemoryValueDraft",
				),

			resetForTestcaseExit: (promptId, prevTestcaseId) =>
				set(
					(state) => {
						const promptScope = draftScopeKey(promptId, null);
						const prevScope = draftScopeKey(promptId, prevTestcaseId);
						const sessionPromptScope = draftScopeKey(promptId, null);

						const inputDrafts = { ...state.inputDrafts };
						delete inputDrafts[promptScope];

						const outputDrafts = { ...state.outputDrafts };
						delete outputDrafts[promptScope];
						delete outputDrafts[prevScope];

						const expectedOutputDrafts = { ...state.expectedOutputDrafts };
						delete expectedOutputDrafts[promptScope];
						delete expectedOutputDrafts[prevScope];

						const expectedThoughtsDrafts = { ...state.expectedThoughtsDrafts };
						delete expectedThoughtsDrafts[promptScope];
						delete expectedThoughtsDrafts[prevScope];

						const sessionDrafts = { ...state.sessionDrafts };
						delete sessionDrafts[sessionPromptScope];

						return {
							inputDrafts,
							outputDrafts,
							expectedOutputDrafts,
							expectedThoughtsDrafts,
							sessionDrafts,
						};
					},
					false,
					"resetForTestcaseExit",
				),

			resetAfterAddTestcase: (promptId) =>
				set(
					(state) => {
						const promptScope = draftScopeKey(promptId, null);
						const sessionPromptScope = draftScopeKey(promptId, null);
						const memorySelectionScope = draftScopeKey(promptId, null);

						const inputDrafts = { ...state.inputDrafts };
						delete inputDrafts[promptScope];

						const outputDrafts = { ...state.outputDrafts };
						delete outputDrafts[promptScope];

						const expectedOutputDrafts = { ...state.expectedOutputDrafts };
						delete expectedOutputDrafts[promptScope];

						const expectedThoughtsDrafts = { ...state.expectedThoughtsDrafts };
						delete expectedThoughtsDrafts[promptScope];

						const sessionDrafts = { ...state.sessionDrafts };
						delete sessionDrafts[sessionPromptScope];

						const memorySelectionDrafts = { ...state.memorySelectionDrafts };
						memorySelectionDrafts[memorySelectionScope] = DEFAULT_MEMORY_SELECTION;

						const memoryValueDrafts = { ...state.memoryValueDrafts };
						delete memoryValueDrafts[memoryValueScopeKey(promptId, null, null)];

						return {
							inputDrafts,
							outputDrafts,
							expectedOutputDrafts,
							expectedThoughtsDrafts,
							sessionDrafts,
							memorySelectionDrafts,
							memoryValueDrafts,
						};
					},
					false,
					"resetAfterAddTestcase",
				),

			resetForPromptExit: (promptId, testcaseId) =>
				set(
					(state) => {
						const scopeKey = draftScopeKey(promptId, testcaseId);
						const memorySelectionScope = draftScopeKey(promptId, testcaseId);

						const inputDrafts = { ...state.inputDrafts };
						delete inputDrafts[scopeKey];

						const outputDrafts = { ...state.outputDrafts };
						delete outputDrafts[scopeKey];

						const expectedOutputDrafts = { ...state.expectedOutputDrafts };
						delete expectedOutputDrafts[scopeKey];

						const expectedThoughtsDrafts = { ...state.expectedThoughtsDrafts };
						delete expectedThoughtsDrafts[scopeKey];

						const sessionDrafts = { ...state.sessionDrafts };
						delete sessionDrafts[scopeKey];

						const memorySelectionDrafts = { ...state.memorySelectionDrafts };
						delete memorySelectionDrafts[memorySelectionScope];

						return {
							inputDrafts,
							outputDrafts,
							expectedOutputDrafts,
							expectedThoughtsDrafts,
							sessionDrafts,
							memorySelectionDrafts,
						};
					},
					false,
					"resetForPromptExit",
				),

			setPageHeaderUi: (value) =>
				set(
					(state) => ({
						pageHeaderUi: {
							...state.pageHeaderUi,
							...value,
						},
					}),
					false,
					"setPageHeaderUi",
				),

			resetPageHeaderUi: () =>
				set(
					() => ({
						pageHeaderUi: DEFAULT_PAGE_HEADER_UI,
					}),
					false,
					"resetPageHeaderUi",
				),
		}),
		{ name: "playground-store", enabled: true },
	),
);

export const usePlaygroundActions = () =>
	usePlaygroundStore(
		useShallow((state) => ({
			resetForTestcaseExit: state.resetForTestcaseExit,
			resetAfterAddTestcase: state.resetAfterAddTestcase,
			resetForPromptExit: state.resetForPromptExit,
		})),
	);

export default usePlaygroundStore;
