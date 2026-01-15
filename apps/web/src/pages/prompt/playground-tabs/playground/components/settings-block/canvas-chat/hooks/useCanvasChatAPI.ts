import { useCallback } from "react";
import { promptApi } from "@/api/prompt";
import type { SendMessageAgentResponse } from "@/types/Canvas";
import type { UseCanvasChatAPIProps } from "../types";

export const useCanvasChatAPI = ({ promptId }: UseCanvasChatAPIProps) => {
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

	const sendMessage = useCallback(
		async (messageText: string, mode: string): Promise<SendMessageAgentResponse> => {
			if (!promptId) throw new Error("Prompt ID is required");
			try {
				const result = await promptApi.sendAgentMessage(promptId, {
					mode: mode,
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

	const createNewChat = useCallback(async () => {
		if (!promptId) return false;
		try {
			await promptApi.createNewAgentChat(promptId);
			return true;
		} catch (error) {
			console.error("Error starting new chat:", error);
			return false;
		}
	}, [promptId]);

	return {
		fetchMessages,
		sendMessage,
		createNewChat,
	};
};
