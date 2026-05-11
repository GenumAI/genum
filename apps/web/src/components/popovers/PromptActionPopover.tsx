import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PopoverContent } from "@/components/ui/popover";
import AudioInput from "@/components/ui/audioInput";
import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";

interface PromptActionPopoverProps {
	placeholder: string;
	value: string;
	onChange: (value: string) => void;
	onAction: () => void;
	buttonText: string;
	buttonIcon?: ReactNode;
	loading?: boolean;
	disabled?: boolean;
	textareaClassName?: string;
	allowEmpty?: boolean;
}

export default function PromptActionPopover({
	placeholder,
	value,
	onChange,
	onAction,
	buttonText,
	buttonIcon,
	loading = false,
	disabled = false,
	textareaClassName = "",
	allowEmpty = false,
}: PromptActionPopoverProps) {
	const [isRecording, setIsRecording] = useState(false);
	const trimmedValue = value.trim();
	const isActionDisabled = disabled || loading || (!allowEmpty && !trimmedValue);

	return (
		<PopoverContent
			align="end"
			onOpenAutoFocus={(event) => event.preventDefault()}
			onCloseAutoFocus={(event) => event.preventDefault()}
			className="w-[600px] p-4 space-y-2 shadow-md border-0 flex flex-col items-end"
		>
			<Textarea
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className={`border-0 bg-transparent shadow-none p-0 resize-none border-transparent focus:outline-none focus:ring-0 focus:border-0 focus:border-transparent focus-visible:ring-0 text-sm text-foreground flex-1 min-h-[150px] ${textareaClassName}`}
			/>
			<div
				className={
					isRecording
						? "w-full h-9 flex items-center gap-2"
						: "ml-auto flex items-center gap-2"
				}
			>
				<AudioInput
					onTextReceived={(recognizedText) => {
						onChange(recognizedText);
					}}
					onRecordingChange={setIsRecording}
				/>
				{!isRecording && (
					<Button disabled={isActionDisabled} onClick={onAction}>
						{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : buttonIcon}
						{buttonText}
					</Button>
				)}
			</div>
		</PopoverContent>
	);
}
