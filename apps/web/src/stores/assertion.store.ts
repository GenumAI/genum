import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

type ScopeParam = string | number | undefined | null;
const toKeyPart = (value: ScopeParam) => (value == null ? "" : String(value));
const promptScopeKey = (promptId: ScopeParam) => toKeyPart(promptId);

type AssertionDraft = {
	value?: string;
	type?: string;
};

interface AssertionState {
	isAssertionModalOpen: boolean;
	assertionDrafts: Record<string, AssertionDraft>;
}

interface AssertionActions {
	openAssertionModal: () => void;
	closeAssertionModal: () => void;
	setAssertionDraft: (promptId: ScopeParam, value: AssertionDraft) => void;
	getAssertionDraft: (promptId: ScopeParam) => AssertionDraft | undefined;
	clearAssertionDraft: (promptId: ScopeParam) => void;
	resetForPromptExit: (promptId: ScopeParam) => void;
}

type AssertionStoreState = AssertionState & AssertionActions;

const initialState: AssertionState = {
	isAssertionModalOpen: false,
	assertionDrafts: {},
};

const useAssertionStore = create<AssertionStoreState>()(
	devtools(
		(set, get) => ({
			...initialState,
			openAssertionModal: () =>
				set({ isAssertionModalOpen: true }, false, "openAssertionModal"),
			closeAssertionModal: () =>
				set({ isAssertionModalOpen: false }, false, "closeAssertionModal"),
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
			resetForPromptExit: (promptId) =>
				set(
					(state) => {
						const key = promptScopeKey(promptId);
						const next = { ...state.assertionDrafts };
						delete next[key];
						return { isAssertionModalOpen: false, assertionDrafts: next };
					},
					false,
					"resetForPromptExit",
				),
		}),
		{ name: "assertion-store", enabled: true },
	),
);

export const useAssertionUI = () =>
	useAssertionStore(
		useShallow((state) => ({
			isAssertionModalOpen: state.isAssertionModalOpen,
		})),
	);

export const useAssertionActions = () =>
	useAssertionStore(
		useShallow((state) => ({
			openAssertionModal: state.openAssertionModal,
			closeAssertionModal: state.closeAssertionModal,
			setAssertionDraft: state.setAssertionDraft,
			getAssertionDraft: state.getAssertionDraft,
			clearAssertionDraft: state.clearAssertionDraft,
			resetForPromptExit: state.resetForPromptExit,
		})),
	);

export default useAssertionStore;
