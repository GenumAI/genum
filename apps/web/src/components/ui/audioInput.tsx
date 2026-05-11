import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { useVoiceVisualizer, VoiceVisualizer } from "react-voice-visualizer";
import { helpersApi } from "@/api/helpers";

interface AudioInputProps {
	disabled?: boolean;
	onTextReceived?: (text: string) => void;
	onRecordingChange?: (isRecording: boolean) => void;
	className?: string;
	size?: "sm" | "md" | "lg";
	variant?: "default" | "compact" | "minimal";
	checkButtonClassName?: string;
	colors?: {
		recording?: string;
		pulse?: string;
		button?: string;
		icon?: string;
		barColor?: string;
	};
}

const AudioInput = ({
	disabled = false,
	onTextReceived,
	onRecordingChange,
	className = "",
	checkButtonClassName = "",
	size = "md",
	variant = "default",
	colors = {},
}: AudioInputProps) => {
	const [isLoading, setIsLoading] = useState(false);
	const { toast } = useToast();
	const recorderControls = useVoiceVisualizer();
	const { startRecording, stopRecording, recordedBlob, error, isRecordingInProgress, audioData } =
		recorderControls;

	// Notify parent about recording state changes
	useEffect(() => {
		if (onRecordingChange) {
			onRecordingChange(isRecordingInProgress);
		}
	}, [isRecordingInProgress, onRecordingChange]);

	const shouldSendRef = useRef(false);

	const sendAudioToServer = async (audioBlob: Blob) => {
		try {
			setIsLoading(true);

			const data = await helpersApi.speechToText(audioBlob);

			if (onTextReceived) {
				onTextReceived(data.text?.trim());
			}
		} catch (error) {
			console.error("Error sending audio:", error);
			toast({
				title: "Failed to convert speech to text",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
			if (recorderControls.mediaRecorder?.stream) {
				recorderControls.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
			}
			recorderControls.clearCanvas();
		}
	};

	// Handle blob available after stop
	useEffect(() => {
		if (recordedBlob && shouldSendRef.current) {
			sendAudioToServer(recordedBlob);
			shouldSendRef.current = false;
		}
	}, [recordedBlob]);

	const handleStartRecording = () => {
		startRecording();
	};

	const handleStopAndSend = () => {
		setIsLoading(true);
		shouldSendRef.current = true;
		stopRecording();
	};

	const handleCancelRecording = () => {
		shouldSendRef.current = false;
		stopRecording();
		if (recorderControls.mediaRecorder?.stream) {
			recorderControls.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
		}
		recorderControls.clearCanvas();
	};

	const sizeConfig = {
		sm: {
			button: "w-6 h-6",
			icon: "w-3 h-3",
		},
		md: {
			button: "w-8 h-8",
			icon: "w-4 h-4",
		},
		lg: {
			button: "w-10 h-10",
			icon: "w-5 h-5",
		},
	};

	const variantConfig = {
		default: {
			button: "",
			hover: "hover:bg-muted",
		},
		compact: {
			button: "border-0 shadow-none",
			hover: "hover:bg-muted/50",
		},
		minimal: {
			button: "border-0 shadow-none bg-transparent",
			hover: "hover:bg-muted",
		},
	};

	const defaultColors = {
		recording: "hsl(var(--brand))",
		pulse: "hsl(var(--brand) / 0.32)",
		button: "transparent",
		icon: "currentColor",
	};

	const finalColors = { ...defaultColors, ...colors };

	if (error) {
		console.error("Voice Visualizer Error:", error);
	}

	if (isRecordingInProgress && !isLoading) {
		return (
			<div className="flex items-center w-full h-full gap-2">
				<Button
					variant="outline"
					size="icon"
					className={cn(
						"shrink-0 rounded-full bg-background border-foreground/20 hover:bg-muted text-foreground",
						sizeConfig[size].button,
					)}
					onClick={handleCancelRecording}
				>
					<X className={cn(sizeConfig[size].icon)} />
				</Button>
				<div className="flex-1 h-full min-h-[40px] relative overflow-hidden">
					<VoiceVisualizer
						controls={recorderControls}
						isControlPanelShown={false}
						height={40}
						width="100%"
						barWidth={2}
						gap={1}
						backgroundColor="transparent"
						mainBarColor={colors.barColor ?? "hsl(var(--foreground))"}
					/>
				</div>
				<Button
					variant="default"
					size="icon"
					className={cn(
						"shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground",
						sizeConfig[size].button,
						checkButtonClassName,
					)}
					onClick={handleStopAndSend}
				>
					<Check className="w-4 h-4" />
				</Button>
			</div>
		);
	}

	return (
		<Button
			variant={isRecordingInProgress && !isLoading ? "default" : "ghost"}
			size="icon"
			className={cn(
				sizeConfig[size].button,
				"relative rounded-full transition-all duration-200",
				variantConfig[variant].button,
				(!isRecordingInProgress || isLoading) && variantConfig[variant].hover,
				className,
			)}
			style={{
				backgroundColor: finalColors.button,
			}}
			onClick={handleStartRecording}
			disabled={disabled || isLoading}
		>
			{isLoading ? (
				<Loader2
					className={cn(sizeConfig[size].icon, "animate-spin z-[3]")}
					style={{ color: finalColors.icon }}
				/>
			) : (
				<Mic
					className={cn(sizeConfig[size].icon, "z-[3]")}
					style={{ color: finalColors.icon }}
				/>
			)}
		</Button>
	);
};

export default AudioInput;
