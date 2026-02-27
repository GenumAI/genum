import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { PromptResponse } from "@/hooks/useRunPrompt";

export type MemorySelectionState = {
	selectedMemoryId: string;
	selectedMemoryKeyName: string;
};

type ScopeParam = string | number | undefined | null;

const toKeyPart = (value: ScopeParam) => (value == null ? "" : String(value));
const draftScopeKey = (promptId: ScopeParam, testcaseId: ScopeParam) =>
	`${toKeyPart(promptId)}::${toKeyPart(testcaseId)}`;
const promptScopeKey = (promptId: ScopeParam) => toKeyPart(promptId);
const memoryValueScopeKey = (promptId: ScopeParam, testcaseId: ScopeParam, memoryId: ScopeParam) =>
	`${toKeyPart(promptId)}::${toKeyPart(testcaseId)}::${toKeyPart(memoryId)}`;

type AssertionDraft = {
	type?: string;
	value?: string;
};

type PlaygroundSessionDraft = {
	runLoading: boolean;
	wasRun: boolean;
	isTestcaseLoaded: boolean;
	status: string;
};

interface PlaygroundUIData {
	modalOpen: boolean;
	showAuditModal: boolean;
	diffModalInfo: { prompt: string } | null;
	isAuditLoading: boolean;
	isFixing: boolean;
	commitMessage: string;
}

interface PlaygroundDraftData {
	inputDrafts: Record<string, string>;
	outputDrafts: Record<string, PromptResponse | null>;
	expectedOutputDrafts: Record<string, PromptResponse | null>;
	expectedThoughtsDrafts: Record<string, string>;
	assertionDrafts: Record<string, AssertionDraft>;
	sessionDrafts: Record<string, PlaygroundSessionDraft>;
	promptDrafts: Record<string, string>;
	memorySelectionDrafts: Record<string, MemorySelectionState>;
	memoryValueDrafts: Record<string, string>;
}

interface PlaygroundUIActions {
	openAssertionModal: () => void;
	closeAssertionModal: () => void;
	openAuditModal: () => void;
	closeAuditModal: () => void;
	setDiffModal: (info: { prompt: string } | null) => void;
	setAuditLoading: (loading: boolean) => void;
	setFixingState: (fixing: boolean) => void;
	setCommitMessage: (message: string) => void;
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

	setAssertionDraft: (promptId: ScopeParam, value: AssertionDraft) => void;
	getAssertionDraft: (promptId: ScopeParam) => AssertionDraft | undefined;
	clearAssertionDraft: (promptId: ScopeParam) => void;

	setSessionDraft: (
		promptId: ScopeParam,
		testcaseId: ScopeParam,
		updater: (prev: PlaygroundSessionDraft) => PlaygroundSessionDraft,
	) => void;
	getSessionDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => PlaygroundSessionDraft;
	clearSessionDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => void;

	setPromptDraft: (promptId: ScopeParam, value: string) => void;
	getPromptDraft: (promptId: ScopeParam) => string | undefined;
	clearPromptDraft: (promptId: ScopeParam) => void;

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
}

type PlaygroundState = PlaygroundUIData &
	PlaygroundDraftData &
	PlaygroundUIActions &
	PlaygroundDraftActions;

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

const initialState: PlaygroundUIData & PlaygroundDraftData = {
	modalOpen: false,
	showAuditModal: false,
	diffModalInfo: null,
	isAuditLoading: false,
	isFixing: false,
	commitMessage: "",

	inputDrafts: {},
	outputDrafts: {},
	expectedOutputDrafts: {},
	expectedThoughtsDrafts: {},
	assertionDrafts: {},
	sessionDrafts: {},
	promptDrafts: {},
	memorySelectionDrafts: {},
	memoryValueDrafts: {},
};

const usePlaygroundStore = create<PlaygroundState>()(
	devtools(
		(set, get) => ({
			...initialState,

			openAssertionModal: () => set({ modalOpen: true }, false, "openAssertionModal"),
			closeAssertionModal: () => set({ modalOpen: false }, false, "closeAssertionModal"),
			openAuditModal: () => set({ showAuditModal: true }, false, "openAuditModal"),
			closeAuditModal: () => set({ showAuditModal: false }, false, "closeAuditModal"),
			setDiffModal: (diffModalInfo) => set({ diffModalInfo }, false, "setDiffModal"),
			setAuditLoading: (isAuditLoading) =>
				set({ isAuditLoading }, false, "setAuditLoading"),
			setFixingState: (isFixing) => set({ isFixing }, false, "setFixingState"),
			setCommitMessage: (commitMessage) =>
				set({ commitMessage }, false, "setCommitMessage"),

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

			setAssertionDraft: (promptId, value) =>
				set(
					(state) => ({
						assertionDrafts: {
							...state.assertionDrafts,
							[promptScopeKey(promptId)]: {
								...state.assertionDrafts[promptScopeKey(promptId)],
								...value,
							},
						},
					}),
					false,
					"setAssertionDraft",
				),
			getAssertionDraft: (promptId) => get().assertionDrafts[promptScopeKey(promptId)],
			clearAssertionDraft: (promptId) =>
				set(
					(state) => {
						const key = promptScopeKey(promptId);
						const next = { ...state.assertionDrafts };
						delete next[key];
						return { assertionDrafts: next };
					},
					false,
					"clearAssertionDraft",
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

			setPromptDraft: (promptId, value) =>
				set(
					(state) => ({
						promptDrafts: {
							...state.promptDrafts,
							[promptScopeKey(promptId)]: value,
						},
					}),
					false,
					"setPromptDraft",
				),
			getPromptDraft: (promptId) => get().promptDrafts[promptScopeKey(promptId)],
			clearPromptDraft: (promptId) =>
				set(
					(state) => {
						const key = promptScopeKey(promptId);
						const next = { ...state.promptDrafts };
						delete next[key];
						return { promptDrafts: next };
					},
					false,
					"clearPromptDraft",
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
						const promptKey = promptScopeKey(promptId);
						const memorySelectionScope = draftScopeKey(promptId, testcaseId);

						const inputDrafts = { ...state.inputDrafts };
						delete inputDrafts[scopeKey];

						const outputDrafts = { ...state.outputDrafts };
						delete outputDrafts[scopeKey];

						const expectedOutputDrafts = { ...state.expectedOutputDrafts };
						delete expectedOutputDrafts[scopeKey];

						const expectedThoughtsDrafts = { ...state.expectedThoughtsDrafts };
						delete expectedThoughtsDrafts[scopeKey];

						const assertionDrafts = { ...state.assertionDrafts };
						delete assertionDrafts[promptKey];

						const sessionDrafts = { ...state.sessionDrafts };
						delete sessionDrafts[scopeKey];

						const promptDrafts = { ...state.promptDrafts };
						delete promptDrafts[promptKey];

						const memorySelectionDrafts = { ...state.memorySelectionDrafts };
						delete memorySelectionDrafts[memorySelectionScope];

						return {
							inputDrafts,
							outputDrafts,
							expectedOutputDrafts,
							expectedThoughtsDrafts,
							assertionDrafts,
							sessionDrafts,
							promptDrafts,
							memorySelectionDrafts,
						};
					},
					false,
					"resetForPromptExit",
				),
		}),
		{ name: "playground-store", enabled: true },
	),
);

export const usePlaygroundUI = () =>
	usePlaygroundStore(
		useShallow((state) => ({
			modalOpen: state.modalOpen,
			showAuditModal: state.showAuditModal,
			diffModalInfo: state.diffModalInfo,
			isAuditLoading: state.isAuditLoading,
			isFixing: state.isFixing,
		})),
	);

export const usePlaygroundActions = () =>
	usePlaygroundStore(
		useShallow((state) => ({
			openAssertionModal: state.openAssertionModal,
			closeAssertionModal: state.closeAssertionModal,
			openAuditModal: state.openAuditModal,
			closeAuditModal: state.closeAuditModal,
			setDiffModal: state.setDiffModal,
			setAuditLoading: state.setAuditLoading,
			setFixingState: state.setFixingState,
			setCommitMessage: state.setCommitMessage,
			resetForTestcaseExit: state.resetForTestcaseExit,
			resetAfterAddTestcase: state.resetAfterAddTestcase,
			resetForPromptExit: state.resetForPromptExit,
		})),
	);

export default usePlaygroundStore;
