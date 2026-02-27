import { useState, useEffect, useCallback, useRef, type KeyboardEvent, useLayoutEffect } from "react";
import { useToast } from "@/hooks/useToast";
import { promptApi } from "@/api/prompt";
import { useAudit } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundAudit";
import type { AuditData } from "@/types/audit";
import type { Message, SendMessageAgentResponse } from "@/types/Canvas";
import type { CanvasChatController } from "../types";
import { useCanvasChatActions } from "./useCanvasChatActions";
import { useAuditActions } from "@/stores/audit.store";
import { useCanvasChatState, useCanvasChatStoreActions } from "@/stores/canvasChat.store";
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
	const { setFixingState } = useAuditActions();

	const ui = useCanvasChatState();
	const uiActions = useCanvasChatStoreActions();

	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const messagesRef = useRef<HTMLDivElement>(null);

	const fetchMessages = useCallback(async () => {
		if (!promptId) return null;
		try {
			const response = await promptApi.getAgentChat(promptId);
			return response?.messages || [];
		} catch (error) {
			console.error("Error fetching agent chat:", error);
			return null;
		}
	}, [promptId]);

	const sendMessageToApi = useCallback(
		async (messageText: string, mode: string): Promise<SendMessageAgentResponse> => {
			if (!promptId) throw new Error("Prompt ID is required");
			try {
				const result = await promptApi.sendAgentMessage(promptId, {
					mode,
					query: messageText,
				});
				return result as SendMessageAgentResponse;
			} catch (error) {
				console.error("Error sending message:", error);
				throw error;
			}
		},
		[promptId],
	);

	const createNewChatApi = useCallback(async () => {
		if (!promptId) return false;
		try {
			await promptApi.createNewAgentChat(promptId);
			return true;
		} catch (error) {
			console.error("Error starting new chat:", error);
			return false;
		}
	}, [promptId]);

	useEffect(() => {
		const loadMessages = async () => {
			const fetchedMessages = await fetchMessages();
			if (fetchedMessages) {
				setMessages(fetchedMessages);
			}
		};
		void loadMessages();
	}, [fetchMessages]);

	useLayoutEffect(() => {
		if (messages.length === 0) return;
	  
		const el = messagesRef.current;
		if (!el) return;
	  
		el.scrollTo({
		  top: el.scrollHeight,
		  behavior: "smooth",
		});
	  }, [messages]);

	// Audit hook
	const { currentAuditData, runAudit, isAuditLoading, isFixing, fixRisks, hydrateAuditData } = useAudit(
		promptId,
		{
			onFixSuccess: (fixedPrompt: string) => {
				uiActions.setDiffModalInfo({ prompt: fixedPrompt });
				uiActions.setShowAuditModal(false);
			},
		},
	);

	// Actions handler
	const actionsController = useCanvasChatActions({
		onEditPrompt: (value: string) => {
			uiActions.setDiffModalInfo({ prompt: value });
		},
		onAuditPrompt: (value: unknown) => {
			hydrateAuditData((value as AuditData) ?? null);
			uiActions.setShowAuditModal(true);
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
			setMessages((prev) => [...prev, userMessage]);
			setIsLoading(true);

			try {
				const data = await sendMessageToApi(messageText, ui.mode);
				const agentMessages = processAgentResponse(
					data.response,
					actionsController.processAction,
				);
				setMessages((prev) => [...prev, ...agentMessages]);
			} catch (error) {
				console.error("Error sending message:", error);
				const errorMessage = createErrorMessage();
				setMessages((prev) => [...prev, errorMessage]);
			} finally {
				setIsLoading(false);
			}
		},
		[
			promptId,
			ui.isOpen,
			ui.mode,
			uiActions,
			sendMessageToApi,
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
		const success = await createNewChatApi();
		if (success) {
			setMessages([]);
		} else {
			toast({
				title: "Error",
				description: "Failed to start new chat",
				variant: "destructive",
				duration: 3000,
			});
		}
	}, [createNewChatApi, toast]);

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
		uiActions.setDiffModalInfo(
			ui.diffModalInfo ? { ...ui.diffModalInfo, prompt: value } : null,
		);
	}, [ui.diffModalInfo, uiActions]);

	const onSaveDiff = useCallback(
		(value: string) => {
			uiActions.setDiffModalInfo(null);
			updatePromptContent(value);
		},
		[uiActions, updatePromptContent],
	);

	const onCloseDiff = useCallback(() => {
		uiActions.setDiffModalInfo(null);
	}, [uiActions]);

	// Audit modal handlers
	const onCloseAudit = useCallback(() => {
		uiActions.setShowAuditModal(false);
	}, [uiActions]);

	const onRunAudit = useCallback(async () => {
		if (promptId) {
			await runAudit(promptId);
		}
	}, [promptId, runAudit]);

	const onFixRisks = useCallback(
		async (recommendations: string[]) => {
			if (!systemPrompt) return;
			setFixingState(true);
			try {
				await fixRisks(systemPrompt, recommendations);
			} finally {
				setFixingState(false);
			}
		},
		[fixRisks, setFixingState, systemPrompt],
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
			showModal: ui.showAuditModal,
			currentData: currentAuditData,
			isLoading: isAuditLoading,
			isFixing,
			onClose: onCloseAudit,
			onRun: onRunAudit,
			onFix: onFixRisks,
		},
		diff: {
			modalInfo: ui.diffModalInfo,
			onChange: onChangeDiff,
			onSave: onSaveDiff,
			onClose: onCloseDiff,
		},
		messagesRef,
	};
};
