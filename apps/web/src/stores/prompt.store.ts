import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { PromptResponse } from "@/api/prompt";

type ScopeParam = string | number | undefined | null;
const toKeyPart = (value: ScopeParam) => (value == null ? "" : String(value));
const promptScopeKey = (promptId: ScopeParam) => toKeyPart(promptId);

interface PromptState {
	commitMessage: string;
	promptDrafts: Record<string, string>;
	runLoading: boolean;
	runError: string | null;
	lastRunResult: PromptResponse | null;
}

interface PromptActions {
	setCommitMessage: (message: string) => void;

	setPromptDraft: (promptId: ScopeParam, value: string) => void;
	getPromptDraft: (promptId: ScopeParam) => string | undefined;
	clearPromptDraft: (promptId: ScopeParam) => void;

	setRunLoading: (loading: boolean) => void;
	setRunError: (error: string | null) => void;
	setLastRunResult: (result: PromptResponse | null) => void;
	resetRunState: () => void;

	resetForPromptExit: (promptId: ScopeParam) => void;
}

type PromptStoreState = PromptState & PromptActions;

const initialState: PromptState = {
	commitMessage: "",
	promptDrafts: {},
	runLoading: false,
	runError: null,
	lastRunResult: null,
};

const usePromptStore = create<PromptStoreState>()(
	devtools(
		(set, get) => ({
			...initialState,

			setCommitMessage: (commitMessage) =>
				set({ commitMessage }, false, "setCommitMessage"),

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

			setRunLoading: (runLoading) => set({ runLoading }, false, "setRunLoading"),
			setRunError: (runError) => set({ runError }, false, "setRunError"),
			setLastRunResult: (lastRunResult) => set({ lastRunResult }, false, "setLastRunResult"),
			resetRunState: () =>
				set(
					{
						runLoading: false,
						runError: null,
						lastRunResult: null,
					},
					false,
					"resetRunState",
				),

			resetForPromptExit: (promptId) =>
				set(
					(state) => {
						const key = promptScopeKey(promptId);

						const promptDrafts = { ...state.promptDrafts };
						delete promptDrafts[key];

						return {
							promptDrafts,
							runLoading: false,
							runError: null,
							lastRunResult: null,
						};
					},
					false,
					"resetForPromptExit",
				),
		}),
		{ name: "prompt-store", enabled: true },
	),
);

export const usePromptUI = () =>
	usePromptStore(
		useShallow((state) => ({
			commitMessage: state.commitMessage,
			runLoading: state.runLoading,
			runError: state.runError,
			lastRunResult: state.lastRunResult,
		})),
	);

export const usePromptActions = () =>
	usePromptStore(
		useShallow((state) => ({
			setCommitMessage: state.setCommitMessage,
			setPromptDraft: state.setPromptDraft,
			getPromptDraft: state.getPromptDraft,
			clearPromptDraft: state.clearPromptDraft,
			setRunLoading: state.setRunLoading,
			setRunError: state.setRunError,
			setLastRunResult: state.setLastRunResult,
			resetRunState: state.resetRunState,
			resetForPromptExit: state.resetForPromptExit,
		})),
	);

export default usePromptStore;
