import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { PromptResponse } from "@/api/prompt";
import type { ConversationMessage, Step, ToolCall } from "@/types/steps";

export type PlaceholderSelectionState = Record<string, string>;

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

type PlaygroundSessionDraft = {
	runLoading: boolean;
	wasRun: boolean;
	isTestcaseLoaded: boolean;
	status: string;
};

/** A tool call awaiting the author's typed-in result, paired with the step it renders as. */
export type PendingToolCall = { call: ToolCall; stepIndex: number };

/**
 * A trajectory being authored in the playground: the steps shown to the author, the
 * ConversationMessage turns sent back to the run endpoint, and the tool calls still
 * waiting on a result. Never persisted -- it only reaches durable storage when the run
 * becomes a testcase (a later feature).
 */
export type TrajectoryDraft = {
	steps: Step[];
	messages: ConversationMessage[];
	pending: PendingToolCall[];
	/**
	 * The trace the server minted for this trajectory's first turn. Echoed back on every
	 * continuation so N requests are logged as one run; null until a tool is called.
	 */
	traceId: string | null;
};

const EMPTY_TRAJECTORY: TrajectoryDraft = {
	steps: [],
	messages: [],
	pending: [],
	traceId: null,
};

interface PlaygroundDraftData {
	inputDrafts: Record<string, string>;
	outputDrafts: Record<string, PromptResponse | null>;
	expectedOutputDrafts: Record<string, PromptResponse | null>;
	expectedThoughtsDrafts: Record<string, string>;
	sessionDrafts: Record<string, PlaygroundSessionDraft>;
	trajectoryDrafts: Record<string, TrajectoryDraft>;
	selectedPlaceholders: PlaceholderSelectionState;
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

	setTrajectoryDraft: (
		promptId: ScopeParam,
		testcaseId: ScopeParam,
		updater: (prev: TrajectoryDraft) => TrajectoryDraft,
	) => void;
	getTrajectoryDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => TrajectoryDraft;
	clearTrajectoryDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => void;

	setSessionDraft: (
		promptId: ScopeParam,
		testcaseId: ScopeParam,
		updater: (prev: PlaygroundSessionDraft) => PlaygroundSessionDraft,
	) => void;
	getSessionDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => PlaygroundSessionDraft;
	clearSessionDraft: (promptId: ScopeParam, testcaseId: ScopeParam) => void;

	setPlaceholderSelection: (key: string, valueName: string) => void;
	clearPlaceholderSelection: (key: string) => void;
	// Wholesale replace, not a merge -- the one write a testcase-pin-seeding effect needs
	// so a prompt/testcase switch cannot leave a stale key from the previous selection
	// mixed in with the newly seeded one.
	replacePlaceholderSelections: (next: PlaceholderSelectionState) => void;

	resetForTestcaseExit: (promptId: ScopeParam, prevTestcaseId: ScopeParam) => void;
	resetAfterAddTestcase: (promptId: ScopeParam) => void;
	resetForPromptExit: (promptId: ScopeParam, testcaseId: ScopeParam) => void;

	setPageHeaderUi: (value: Partial<PageHeaderUiState>) => void;
	resetPageHeaderUi: () => void;
}

type PlaygroundState = PlaygroundDraftData & PlaygroundDraftActions;

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
	trajectoryDrafts: {},
	selectedPlaceholders: {},
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

			setTrajectoryDraft: (promptId, testcaseId, updater) =>
				set(
					(state) => {
						const key = draftScopeKey(promptId, testcaseId);
						const prev = state.trajectoryDrafts[key] ?? EMPTY_TRAJECTORY;
						return {
							trajectoryDrafts: {
								...state.trajectoryDrafts,
								[key]: updater(prev),
							},
						};
					},
					false,
					"setTrajectoryDraft",
				),
			getTrajectoryDraft: (promptId, testcaseId) =>
				get().trajectoryDrafts[draftScopeKey(promptId, testcaseId)] ?? EMPTY_TRAJECTORY,
			clearTrajectoryDraft: (promptId, testcaseId) =>
				set(
					(state) => {
						const key = draftScopeKey(promptId, testcaseId);
						const next = { ...state.trajectoryDrafts };
						delete next[key];
						return { trajectoryDrafts: next };
					},
					false,
					"clearTrajectoryDraft",
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

			setPlaceholderSelection: (key, valueName) =>
				set(
					(state) => ({
						selectedPlaceholders: {
							...state.selectedPlaceholders,
							[key]: valueName,
						},
					}),
					false,
					"setPlaceholderSelection",
				),
			clearPlaceholderSelection: (key) =>
				set(
					(state) => {
						const next = { ...state.selectedPlaceholders };
						delete next[key];
						return { selectedPlaceholders: next };
					},
					false,
					"clearPlaceholderSelection",
				),
			replacePlaceholderSelections: (next) =>
				set({ selectedPlaceholders: next }, false, "replacePlaceholderSelections"),

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

						const trajectoryDrafts = { ...state.trajectoryDrafts };
						delete trajectoryDrafts[promptScope];
						delete trajectoryDrafts[prevScope];

						return {
							inputDrafts,
							outputDrafts,
							expectedOutputDrafts,
							expectedThoughtsDrafts,
							sessionDrafts,
							trajectoryDrafts,
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

						const trajectoryDrafts = { ...state.trajectoryDrafts };
						delete trajectoryDrafts[promptScope];

						return {
							inputDrafts,
							outputDrafts,
							expectedOutputDrafts,
							expectedThoughtsDrafts,
							sessionDrafts,
							trajectoryDrafts,
						};
					},
					false,
					"resetAfterAddTestcase",
				),

			resetForPromptExit: (promptId, testcaseId) =>
				set(
					(state) => {
						const scopeKey = draftScopeKey(promptId, testcaseId);

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

						const trajectoryDrafts = { ...state.trajectoryDrafts };
						delete trajectoryDrafts[scopeKey];

						return {
							inputDrafts,
							outputDrafts,
							expectedOutputDrafts,
							expectedThoughtsDrafts,
							sessionDrafts,
							trajectoryDrafts,
							// selectedPlaceholders is a flat, unscoped map (see its declaration
							// above), so there is no per-prompt key to delete here — leaving a
							// prompt clears the whole thing rather than let a stale key from
							// this prompt keep shipping in another prompt's run body.
							selectedPlaceholders: {},
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
