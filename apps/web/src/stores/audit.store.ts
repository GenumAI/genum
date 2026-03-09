import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

type AuditDiffModalInfo = { prompt: string } | null;

interface AuditUIState {
	showAuditModal: boolean;
	diffModalInfo: AuditDiffModalInfo;
	isAuditLoading: boolean;
	isFixing: boolean;
}

interface AuditUIActions {
	openAuditModal: () => void;
	closeAuditModal: () => void;
	setDiffModal: (info: AuditDiffModalInfo) => void;
	setAuditLoading: (loading: boolean) => void;
	setFixingState: (fixing: boolean) => void;
}

type AuditState = AuditUIState & AuditUIActions;

const initialState: AuditUIState = {
	showAuditModal: false,
	diffModalInfo: null,
	isAuditLoading: false,
	isFixing: false,
};

const useAuditStore = create<AuditState>()(
	devtools(
		(set) => ({
			...initialState,
			openAuditModal: () => set({ showAuditModal: true }, false, "openAuditModal"),
			closeAuditModal: () => set({ showAuditModal: false }, false, "closeAuditModal"),
			setDiffModal: (diffModalInfo) => set({ diffModalInfo }, false, "setDiffModal"),
			setAuditLoading: (isAuditLoading) => set({ isAuditLoading }, false, "setAuditLoading"),
			setFixingState: (isFixing) => set({ isFixing }, false, "setFixingState"),
		}),
		{ name: "audit-store", enabled: true },
	),
);

export const useAuditUI = () =>
	useAuditStore(
		useShallow((state) => ({
			showAuditModal: state.showAuditModal,
			diffModalInfo: state.diffModalInfo,
			isAuditLoading: state.isAuditLoading,
			isFixing: state.isFixing,
		})),
	);

export const useAuditActions = () =>
	useAuditStore(
		useShallow((state) => ({
			openAuditModal: state.openAuditModal,
			closeAuditModal: state.closeAuditModal,
			setDiffModal: state.setDiffModal,
			setAuditLoading: state.setAuditLoading,
			setFixingState: state.setFixingState,
		})),
	);

export default useAuditStore;
