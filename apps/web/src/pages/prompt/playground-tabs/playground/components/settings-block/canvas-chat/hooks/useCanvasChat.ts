import { useState, useCallback, type KeyboardEvent } from "react";
import { useToast } from "@/hooks/useToast";
import { useAudit } from "@/hooks/useAudit";
import type { CanvasChatController, DiffModalInfo } from "../types";
import { useCanvasChatAPI } from "./useCanvasChatAPI";
import { useCanvasChatMessages } from "./useCanvasChatMessages";
import { useCanvasChatActions } from "./useCanvasChatActions";
import { useCanvasChatUI } from "./useCanvasChatUI";
import {
	createUserMessage,
	processAgentResponse,
	createErrorMessage,
} from "../utils/messageProcessors";

interface UseCanvasChatProps {
	promptId?: number;
	systemPrompt: string;
	updatePromptContent: (value: string) => void;
}

export const useCanvasChat = ({
	promptId,
	systemPrompt,
	updatePromptContent,
}: UseCanvasChatProps): CanvasChatController => {
	const { toast } = useToast();

	// UI state
	const { ui, actions: uiActions } = useCanvasChatUI();

	// Messages state
	const messagesController = useCanvasChatMessages({ promptId });
	const { messages, isLoading, messagesRef, addMessage, addMessages, clearMessages, setLoadingState } =
		messagesController;

	// API
	const api = useCanvasChatAPI({ promptId });

	// Diff modal state
	const [diffModalInfo, setDiffModalInfo] = useState<DiffModalInfo | null>(null);

	// Audit modal state
	const [showAuditModal, setShowAuditModal] = useState(false);
	const [isFixing, setIsFixing] = useState(false);

	// Audit hook
	const { currentAuditData, setCurrentAuditData, runAudit, isAuditLoading, fixRisks } = useAudit({
		onFixSuccess: (fixedPrompt) => {
			setDiffModalInfo({ prompt: fixedPrompt });
			setShowAuditModal(false);
		},
	});

	// Actions handler
	const actionsController = useCanvasChatActions({
		onEditPrompt: (value: string) => {
			setDiffModalInfo({ prompt: value });
		},
		onAuditPrompt: (value: any) => {
			setCurrentAuditData(value);
			setShowAuditModal(true);
		},
	});

	// Send message logic
	const sendMessageInternal = useCallback(
		async (messageText: string) => {
			if (!promptId) return;

			// Open chat if closed
			if (!ui.isOpen) {
				uiActions.setIsOpen(true);
			}

			// Add user message
			const userMessage = createUserMessage(messageText);
			addMessage(userMessage);
			setLoadingState(true);

			try {
				const data = await api.sendMessage(messageText, ui.mode);
				const agentMessages = processAgentResponse(data.response, actionsController.processAction);
				addMessages(agentMessages);
			} catch (error) {
				console.error("Error sending message:", error);
				const errorMessage = createErrorMessage();
				addMessage(errorMessage);
			} finally {
				setLoadingState(false);
			}
		},
		[
			promptId,
			ui.isOpen,
			ui.mode,
			uiActions,
			addMessage,
			addMessages,
			setLoadingState,
			api,
			actionsController,
		],
	);

	// Send message actions
	const sendMessage = useCallback(async () => {
		if (!ui.message.trim() || isLoading || !promptId) return;
		const messageText = ui.message.trim();
		uiActions.setMessage("");
		await sendMessageInternal(messageText);
	}, [ui.message, isLoading, promptId, uiActions, sendMessageInternal]);

	const sendMessageWithText = useCallback(
		async (text: string) => {
			if (!text.trim() || isLoading || !promptId) return;
			await sendMessageInternal(text.trim());
		},
		[isLoading, promptId, sendMessageInternal],
	);

	// Create new chat
	const createNewChat = useCallback(async () => {
		const success = await api.createNewChat();
		if (success) {
			clearMessages();
		} else {
			toast({
				title: "Error",
				description: "Failed to start new chat",
				variant: "destructive",
				duration: 3000,
			});
		}
	}, [api, clearMessages, toast]);

	// Handle key press
	const handleKeyPress = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				sendMessage();
			}
		},
		[sendMessage],
	);

	// Diff modal handlers
	const onChangeDiff = useCallback((value: string) => {
		setDiffModalInfo((prevState) => (prevState ? { ...prevState, prompt: value } : null));
	}, []);

	const onSaveDiff = useCallback(
		(value: string) => {
			setDiffModalInfo(null);
			updatePromptContent(value);
		},
		[updatePromptContent],
	);

	const onCloseDiff = useCallback(() => {
		setDiffModalInfo(null);
	}, []);

	// Audit modal handlers
	const onCloseAudit = useCallback(() => {
		setShowAuditModal(false);
	}, []);

	const onRunAudit = useCallback(async () => {
		if (promptId) {
			await runAudit(promptId);
		}
	}, [promptId, runAudit]);

	const onFixRisks = useCallback(
		async (recommendations: string[]) => {
			if (!systemPrompt) return;
			setIsFixing(true);
			await fixRisks(systemPrompt, recommendations);
			setIsFixing(false);
		},
		[systemPrompt, fixRisks],
	);

	return {
		messages: {
			data: messages,
			loading: isLoading,
		},
		ui,
		actions: {
			sendMessage,
			sendMessageWithText,
			createNewChat,
			handleKeyPress,
			...uiActions,
		},
		audit: {
			showModal: showAuditModal,
			currentData: currentAuditData,
			isLoading: isAuditLoading,
			isFixing,
			onClose: onCloseAudit,
			onRun: onRunAudit,
			onFix: onFixRisks,
		},
		diff: {
			modalInfo: diffModalInfo,
			onChange: onChangeDiff,
			onSave: onSaveDiff,
			onClose: onCloseDiff,
		},
		messagesRef,
	};
};
