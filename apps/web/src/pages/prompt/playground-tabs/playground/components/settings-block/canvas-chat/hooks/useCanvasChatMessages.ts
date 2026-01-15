import { useState, useEffect, useCallback, useRef } from "react";
import type { Message } from "@/types/Canvas";
import type { UseCanvasChatMessagesProps } from "../types";
import { useCanvasChatAPI } from "./useCanvasChatAPI";

export const useCanvasChatMessages = ({ promptId }: UseCanvasChatMessagesProps) => {
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const messagesRef = useRef<HTMLDivElement>(null);
	const { fetchMessages } = useCanvasChatAPI({ promptId });

	// Load messages on mount
	useEffect(() => {
		const loadMessages = async () => {
			const fetchedMessages = await fetchMessages();
			if (fetchedMessages) {
				setMessages(fetchedMessages);
			}
		};

		loadMessages();
	}, [fetchMessages]);

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		if (messagesRef.current) {
			messagesRef.current.scrollBy({
				top: messagesRef.current.scrollHeight,
				behavior: "smooth",
			});
		}
	}, []);

	const addMessage = useCallback((message: Message) => {
		setMessages((prev) => [...prev, message]);
	}, []);

	const addMessages = useCallback((newMessages: Message[]) => {
		setMessages((prev) => [...prev, ...newMessages]);
	}, []);

	const clearMessages = useCallback(() => {
		setMessages([]);
	}, []);

	const setLoadingState = useCallback((loading: boolean) => {
		setIsLoading(loading);
	}, []);

	return {
		messages,
		isLoading,
		messagesRef,
		addMessage,
		addMessages,
		clearMessages,
		setLoadingState,
	};
};
