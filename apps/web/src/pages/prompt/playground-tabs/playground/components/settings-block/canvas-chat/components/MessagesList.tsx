import React from "react";
import { Message } from "@/types/Canvas";
import { ChatMessage } from "./ChatMessage";
import { LoadingIndicator } from "./LoadingIndicator";

interface MessagesListProps {
	messages: Message[];
	isLoading: boolean;
	messagesRef: React.RefObject<HTMLDivElement | null>;
	inputHeight: number;
}

export const MessagesList = React.memo<MessagesListProps>(
	({ messages, isLoading, messagesRef, inputHeight }) => {
		return (
			<div
				ref={messagesRef}
				className="flex flex-col flex-grow gap-3 my-6 overflow-y-auto minimal-scrollbar pr-1 -mr-1"
				style={{
					maxHeight: `calc(75vh - ${inputHeight + 200}px)`,
				}}
			>
				{messages.map((msg, index) => (
					<ChatMessage key={msg.id || index} message={msg} />
				))}
				{isLoading && <LoadingIndicator />}
			</div>
		);
	}
);

MessagesList.displayName = "MessagesList";
