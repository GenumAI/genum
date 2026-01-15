import React from "react";
import { Message } from "@/types/Canvas";
import { MessageContent } from "./MessageContent";
import { ActionMessageCard } from "./ActionMessageCard";
import { ACTION_MESSAGES } from "../utils/constants";

interface ChatMessageProps {
	message: Message;
}

export const ChatMessage = React.memo<ChatMessageProps>(({ message }) => {
	const isUser = message.role === "user";

	return (
		<div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[95%] rounded-md text-sm ${
					isUser ? "bg-muted text-foreground px-2 py-1" : "text-foreground px-0 py-2"
				}`}
			>
				<MessageContent content={message.message} />
				{(message.action?.type === "edit_prompt" ||
					message.action?.type === "audit_prompt") && (
					<ActionMessageCard {...ACTION_MESSAGES[message.action.type]} />
				)}
			</div>
		</div>
	);
});

ChatMessage.displayName = "ChatMessage";
