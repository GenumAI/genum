import type React from "react";
import { useRef } from "react";
import type { Message } from "@/types/Canvas";
import { DefaultOptions } from "./components/DefaultOptions";
import { MessagesList } from "./components/MessagesList";
import { ChatInput } from "./components/ChatInput";

interface CanvasChatUIProps {
	isOpen: boolean;
	messages: Message[];
	isLoading: boolean;
	messagesRef: React.RefObject<HTMLDivElement | null>;
	message: string;
	setMessage: React.Dispatch<React.SetStateAction<string>>;
	handleKeyPress: (e: React.KeyboardEvent) => void;
	mode: string;
	setMode: (mode: string) => void;
	isRecording: boolean;
	setIsRecording: (isRecording: boolean) => void;
	sendMessage: () => void;
	sendMessageWithText: (text: string) => void;
}

const CanvasChatUI: React.FC<CanvasChatUIProps> = ({
	isOpen,
	messages,
	isLoading,
	messagesRef,
	message,
	setMessage,
	handleKeyPress,
	mode,
	setMode,
	isRecording,
	setIsRecording,
	sendMessage,
	sendMessageWithText,
}) => {
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const inputHeight = Number(inputRef.current?.offsetHeight ?? 0);

	const hasMessages = messages.length > 0;

	return (
		<div className="flex flex-col h-full relative overflow-x-visible">
			{isOpen && !hasMessages ? (
				<div
					ref={messagesRef}
					className="flex flex-col flex-grow justify-center gap-3 mt-3 mb-6 overflow-y-auto"
					style={{
						maxHeight: `calc(75vh - ${inputHeight + 300}px)`,
					}}
				>
					<DefaultOptions onOptionClick={sendMessageWithText} />
				</div>
			) : (
				isOpen && (
					<MessagesList
						messages={messages}
						isLoading={isLoading}
						messagesRef={messagesRef}
						inputHeight={inputHeight}
					/>
				)
			)}

			<ChatInput
				message={message}
				setMessage={setMessage}
				handleKeyPress={handleKeyPress}
				mode={mode}
				setMode={setMode}
				isRecording={isRecording}
				setIsRecording={setIsRecording}
				isLoading={isLoading}
				sendMessage={sendMessage}
				inputRef={inputRef}
			/>
		</div>
	);
};

export default CanvasChatUI;
