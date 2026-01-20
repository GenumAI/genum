import type { Message, Action, SendMessageAgentResponse } from "@/types/Canvas";

export const createUserMessage = (text: string): Message => ({
	id: Date.now().toString(),
	message: text,
	role: "user",
	timestamp: new Date(),
	type: "text",
});

export const createAgentMessage = (
	messageText: string,
	type: "text" | "action",
	action?: Action,
	index = 0,
): Message => ({
	id: (Date.now() + index + 1).toString(),
	message: messageText,
	role: "agent",
	timestamp: new Date(),
	type,
	action:
		type === "action" && action
			? {
					type: action.type,
					value:
						action.type === "edit_prompt"
							? action.value
							: action.type === "audit_prompt"
								? JSON.stringify(action.value)
								: "",
				}
			: undefined,
});

export const formatAuditMessage = (audit: any): string => {
	return `\n\n**Audit Summary:**\n${audit.summary}\n\n**Overall Score: ${audit.rate}/100**`;
};

export const processResponseItem = (item: any): { messageText: string; action?: Action } => {
	let messageText = "";
	let action: Action | undefined;

	if (item.type === "action" && item.action) {
		messageText = item.message || "Action completed";

		if (item.action.type === "audit_prompt" && item.action.value) {
			messageText += formatAuditMessage(item.action.value);
		}

		action = item.action;
	} else if (item.type === "text") {
		messageText = item.message || "No message";
	} else {
		messageText = item.message || JSON.stringify(item);
	}

	return { messageText, action };
};

export const processAgentResponse = (
	response: SendMessageAgentResponse["response"],
	handleAction: (action: Action) => void,
): Message[] => {
	const messages: Message[] = [];

	if (Array.isArray(response)) {
		response.forEach((item, index) => {
			const { messageText, action } = processResponseItem(item);

			if (action) {
				handleAction(action);
			}

			messages.push(createAgentMessage(messageText, item.type, action, index));
		});
	} else {
		let messageText = "Sorry, I couldn't process your request.";
		let messageType: "text" | "action" = "text";
		let actionData: Action | undefined;

		if (typeof response === "string") {
			messageText = response;
		} else if (response && typeof response === "object" && "message" in response) {
			messageText = (response as any).message || messageText;
			const responseType = (response as any).type;
			messageType = responseType === "action" || responseType === "text" ? responseType : "text";

			if (responseType === "action" && (response as any).action) {
				actionData = (response as any).action;
				handleAction(actionData);
			}
		}

		messages.push(createAgentMessage(messageText, messageType, actionData));
	}

	return messages;
};

export const createErrorMessage = (): Message => ({
	id: (Date.now() + 1).toString(),
	message: "Sorry, there was an error processing your request. Please try again.",
	role: "agent",
	timestamp: new Date(),
	type: "text",
});
