import { useState, useCallback } from "react";
import type { ChatUIState, ChatUIActions } from "../types";

export const useCanvasChatUI = () => {
	const [isOpen, setIsOpen] = useState(true);
	const [isModalMode, setIsModalMode] = useState(false);
	const [message, setMessage] = useState("");
	const [mode, setMode] = useState("agent");
	const [isRecording, setIsRecording] = useState(false);

	const toggleOpen = useCallback(() => {
		setIsOpen((prev) => !prev);
	}, []);

	const toggleModalMode = useCallback(() => {
		setIsModalMode((prev) => !prev);
	}, []);

	const ui: ChatUIState = {
		isOpen,
		isModalMode,
		message,
		mode,
		isRecording,
	};

	const actions: ChatUIActions = {
		setIsOpen,
		setIsModalMode,
		setMessage,
		setMode,
		setIsRecording,
		toggleOpen,
		toggleModalMode,
	};

	return {
		ui,
		actions,
	};
};
