import React from "react";
import { Loader2, Send } from "lucide-react";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AutoResizableTextarea } from "@/components/ui/textarea";
import AudioInput from "@/components/ui/audioInput";
import { CHAT_MODES } from "../utils/constants";

interface ChatInputProps {
	message: string;
	setMessage: React.Dispatch<React.SetStateAction<string>>;
	handleKeyPress: (e: React.KeyboardEvent) => void;
	mode: string;
	setMode: (mode: string) => void;
	isRecording: boolean;
	setIsRecording: (isRecording: boolean) => void;
	isLoading: boolean;
	sendMessage: () => void;
	inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const ChatInput = React.memo<ChatInputProps>(
	({
		message,
		setMessage,
		handleKeyPress,
		mode,
		setMode,
		isRecording,
		setIsRecording,
		isLoading,
		sendMessage,
		inputRef,
	}) => {
		return (
			<div className="mt-auto">
				<hr className="border mb-3 border-primary/20" />

				<AutoResizableTextarea
					ref={inputRef}
					placeholder="Ask a follow up..."
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					onKeyPress={handleKeyPress}
					maxRows={6}
					disabled={isRecording}
					className="text-sm min-h-5 px-0 p-0 mb-2 !bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
				/>

				<div className="flex items-center gap-2">
					{!isRecording && (
						<Select value={mode} onValueChange={setMode}>
							<SelectTrigger className="w-auto h-7 bg-transparent dark:bg-transparent shadow-none border-none focus:outline-none focus:ring-0 focus:border-none px-0 gap-1 text-[12px] font-medium text-foreground">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={CHAT_MODES.AGENT}>Agent</SelectItem>
								<SelectItem value={CHAT_MODES.ASK}>Ask</SelectItem>
							</SelectContent>
						</Select>
					)}

					<div className={isRecording ? "w-full h-7" : "ml-auto flex items-center gap-2"}>
						<AudioInput
							disabled={isLoading}
							onTextReceived={(text) => {
								setMessage((prev) => prev + (prev ? " " : "") + text);
							}}
							onRecordingChange={setIsRecording}
							className="w-7 h-7"
							checkButtonClassName="w-7 h-7"
						/>

						{!isRecording && (
							<Button
								size="icon"
								className="h-7 w-7 rounded-lg border text-primary bg-background hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
								onClick={sendMessage}
								disabled={isLoading || !message.trim()}
							>
								{isLoading ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									<Send className="w-4 h-4" />
								)}
							</Button>
						)}
					</div>
				</div>
			</div>
		);
	},
);

ChatInput.displayName = "ChatInput";
