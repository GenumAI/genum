import React, { useRef } from "react";
import { Loader2, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
import { Message } from "@/types/Canvas";

const DEFAULT_OPTIONS = [
	{
		text: "Optimize prompt",
		description: "I can help you improve your prompt for better results",
	},
	{
		text: "Fix prompt",
		description: "Let me help you troubleshoot and fix your prompt",
	},
	{
		text: "Audit prompt",
		description: "Audit the prompt for potential issues and improve it",
	},
];

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

const ACTION_MESSAGES = {
	edit_prompt: {
		title: "Prompt edited",
		description: "Please review the updated prompt and accept it.",
	},
	audit_prompt: {
		title: "Prompt audited",
		description: "Please review the audit suggestions.",
	},
};

const ActionMessageCard = ({ title, description }: { title: string; description: string }) => {
	return (
		<div className="mt-3 w-full rounded-xl p-3 bg-muted border border-border text-left hover:bg-muted/80 transition-colors">
			<div className="text-xs font-semibold text-foreground">{title}</div>
			<div className="text-[10px] text-muted-foreground">{description}</div>
		</div>
	);
};

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

	return (
		<div className="flex flex-col h-full relative overflow-x-visible">
			{isOpen && (
				<>
					{messages.length === 0 ? (
						<div
							ref={messagesRef}
							className="flex flex-col flex-grow justify-center gap-3 mt-3 mb-6 overflow-y-auto"
							style={{
								maxHeight: `calc(75vh - ${inputHeight + 300}px)`,
							}}
						>
							<div className="flex flex-col gap-2.5 mt-3">
								{DEFAULT_OPTIONS.map((option, index) => (
									<button
										key={index}
										className="rounded-xl p-3 bg-muted border border-border text-left hover:bg-muted/80 transition-colors"
										onClick={() => sendMessageWithText(option.text)}
									>
										<div className="text-xs font-semibold text-foreground">
											{option.text}
										</div>
										<div className="text-[10px] text-muted-foreground">
											{option.description}
										</div>
									</button>
								))}
							</div>
						</div>
					) : (
						<div
							ref={messagesRef}
							className="flex flex-col flex-grow gap-3 my-6 overflow-y-auto minimal-scrollbar pr-1 -mr-1"
							style={{
								maxHeight: `calc(75vh - ${inputHeight + 200}px)`,
							}}
						>
							{messages.map((msg, index) => (
								<div
									key={msg.id || index}
									className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
								>
									<div
										className={`max-w-[95%] rounded-md text-sm ${
											msg.role === "user"
												? "bg-muted text-foreground px-2 py-1"
												: "text-foreground px-0 py-2"
										}`}
									>
										<div className="break-words">
											<ReactMarkdown
												remarkPlugins={[remarkGfm]}
												components={{
													p: ({ children }) => (
														<p className="leading-relaxed break-words mb-2 last:mb-0">
															{children}
														</p>
													),
													code: ({ children }) => (
														<code className="bg-muted px-1 py-0.5 rounded text-xs break-words">
															{children}
														</code>
													),
													blockquote: ({ children }) => (
														<blockquote className="border-l-2 border-muted-foreground pl-4 italic mb-2 last:mb-0 break-words">
															{children}
														</blockquote>
													),
													h1: ({ children }) => (
														<h1 className="text-lg font-bold mb-2 last:mb-0 break-words">
															{children}
														</h1>
													),
													h2: ({ children }) => (
														<h2 className="text-base font-bold mb-2 last:mb-0 break-words">
															{children}
														</h2>
													),
													h3: ({ children }) => (
														<h3 className="text-sm font-bold mb-2 last:mb-0 break-words">
															{children}
														</h3>
													),
													ul: ({ children }) => (
														<ul className="list-disc pl-5 space-y-1 mb-2 last:mb-0 break-words">
															{children}
														</ul>
													),
													ol: ({ children }) => (
														<ol className="list-decimal pl-5 space-y-1 mb-2 last:mb-0 break-words">
															{children}
														</ol>
													),
													li: ({ children }) => (
														<li className="ml-2 break-words">
															{children}
														</li>
													),
													strong: ({ children }) => (
														<strong className="font-semibold break-words">
															{children}
														</strong>
													),
													em: ({ children }) => (
														<em className="italic break-words">
															{children}
														</em>
													),
													del: ({ children }) => (
														<del className="line-through break-words">
															{children}
														</del>
													),
													a: ({ children, href }) => (
														<a
															href={href}
															target="_blank"
															rel="noopener noreferrer"
															className="text-blue-500 underline break-words"
														>
															{children}
														</a>
													),
													pre: ({ children }) => (
														<pre className="bg-muted p-2 rounded-md overflow-x-auto text-xs mb-2 last:mb-0 break-words">
															{children}
														</pre>
													),
												}}
											>
												{msg.message}
											</ReactMarkdown>
										</div>
										{(msg.action?.type === "edit_prompt" ||
											msg.action?.type === "audit_prompt") && (
											<ActionMessageCard
												{...ACTION_MESSAGES[msg.action?.type]}
											/>
										)}
									</div>
								</div>
							))}
							{isLoading && (
								<div className="flex justify-start">
									<div className="px-3 py-2 text-sm">
										<div className="flex space-x-1">
											<div className="w-2 h-2 bg-[#71717A] rounded-full animate-bounce"></div>
											<div
												className="w-2 h-2 bg-[#71717A] rounded-full animate-bounce"
												style={{ animationDelay: "0.1s" }}
											></div>
											<div
												className="w-2 h-2 bg-[#71717A] rounded-full animate-bounce"
												style={{ animationDelay: "0.2s" }}
											></div>
										</div>
									</div>
								</div>
							)}
						</div>
					)}
				</>
			)}

			<div className="mt-auto">
				<hr className={`border mb-3 border-primary/20`} />

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
								<SelectItem value="agent">Agent</SelectItem>
								<SelectItem value="ask">Ask</SelectItem>
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
		</div>
	);
};

export default CanvasChatUI;
