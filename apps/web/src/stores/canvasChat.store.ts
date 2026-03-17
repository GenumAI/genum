import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { SetStateAction } from "react";
import type { DiffModalInfo } from "@/pages/prompt/playground-tabs/playground/components/settings-block/canvas-chat/types";

interface CanvasChatState {
	isOpen: boolean;
	isModalMode: boolean;
	message: string;
	mode: string;
	isRecording: boolean;
	showAuditModal: boolean;
	diffModalInfo: DiffModalInfo | null;
}

interface CanvasChatActions {
	setIsOpen: (value: boolean) => void;
	setIsModalMode: (value: boolean) => void;
	setMessage: (value: SetStateAction<string>) => void;
	setMode: (value: string) => void;
	setIsRecording: (value: boolean) => void;
	setShowAuditModal: (value: boolean) => void;
	setDiffModalInfo: (value: DiffModalInfo | null) => void;
	toggleOpen: () => void;
	toggleModalMode: () => void;
}

type CanvasChatStore = CanvasChatState & CanvasChatActions;

const initialState: CanvasChatState = {
	isOpen: true,
	isModalMode: false,
	message: "",
	mode: "agent",
	isRecording: false,
	showAuditModal: false,
	diffModalInfo: null,
};

const useCanvasChatStore = create<CanvasChatStore>()(
	devtools(
		(set) => ({
			...initialState,
			setIsOpen: (isOpen) => set({ isOpen }, false, "setIsOpen"),
			setIsModalMode: (isModalMode) => set({ isModalMode }, false, "setIsModalMode"),
			setMessage: (message) =>
				set(
					(state) => ({
						message: typeof message === "function" ? message(state.message) : message,
					}),
					false,
					"setMessage",
				),
			setMode: (mode) => set({ mode }, false, "setMode"),
			setIsRecording: (isRecording) => set({ isRecording }, false, "setIsRecording"),
			setShowAuditModal: (showAuditModal) =>
				set({ showAuditModal }, false, "setShowAuditModal"),
			setDiffModalInfo: (diffModalInfo) => set({ diffModalInfo }, false, "setDiffModalInfo"),
			toggleOpen: () => set((state) => ({ isOpen: !state.isOpen }), false, "toggleOpen"),
			toggleModalMode: () =>
				set((state) => ({ isModalMode: !state.isModalMode }), false, "toggleModalMode"),
		}),
		{ name: "canvas-chat-store", enabled: true },
	),
);

export const useCanvasChatState = () =>
	useCanvasChatStore(
		useShallow((state) => ({
			isOpen: state.isOpen,
			isModalMode: state.isModalMode,
			message: state.message,
			mode: state.mode,
			isRecording: state.isRecording,
			showAuditModal: state.showAuditModal,
			diffModalInfo: state.diffModalInfo,
		})),
	);

export const useCanvasChatStoreActions = () =>
	useCanvasChatStore(
		useShallow((state) => ({
			setIsOpen: state.setIsOpen,
			setIsModalMode: state.setIsModalMode,
			setMessage: state.setMessage,
			setMode: state.setMode,
			setIsRecording: state.setIsRecording,
			setShowAuditModal: state.setShowAuditModal,
			setDiffModalInfo: state.setDiffModalInfo,
			toggleOpen: state.toggleOpen,
			toggleModalMode: state.toggleModalMode,
		})),
	);

export default useCanvasChatStore;
