import { forwardRef, useState, type ChangeEvent } from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { usePlaygroundContent, usePlaygroundActions } from "@/stores/playground.store";
import { useInputResize } from "./hooks/useInputResize";
import { useInputGeneration } from "./hooks/useInputGeneration";
import { InputContent } from "./components/InputContent";
import { InputActions } from "./components/InputActions";
import { InputExpandedDialog } from "./components/InputExpandedDialog";

interface InputTextAreaProps {
	onBlur?: () => void;
	promptId?: number;
	systemPrompt?: string;
}

export const InputTextArea = forwardRef<HTMLTextAreaElement, InputTextAreaProps>(
	({ onBlur, promptId, systemPrompt }, ref) => {
		const { inputContent, hasPromptContent, hasInputContent } = usePlaygroundContent();
		const { setInputContent } = usePlaygroundActions();

		// State management
		const [isExpanded, setExpanded] = useState(false);
		const [isPreviewMode, setPreviewMode] = useState(false);

		// Custom hooks
		const { textareaHeight, handleResizeStart } = useInputResize({ minHeight: 140 });
		const { aiQuery, setAiQuery, isPopoverOpen, setIsPopoverOpen, handleGenerate, isLoading } =
			useInputGeneration({ promptId, systemPrompt });

		// Handlers
		const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
			setInputContent(e.target.value);
		};

		const handleExpandToggle = () => {
			setExpanded(!isExpanded);
		};

		const handlePreviewToggle = () => {
			setPreviewMode(!isPreviewMode);
		};

		const handleBlur = () => {
			if (onBlur) {
				onBlur();
			}
		};

		// AI button state
		const isAIButtonActive = hasPromptContent && !hasInputContent && !!promptId;
		const getInactiveReason = () => {
			if (!hasPromptContent) return "No prompt available";
			if (hasInputContent) return "Input already exists";
			if (!promptId) return "No prompt selected";
			return "";
		};

		return (
			<>
				<div className="flex flex-col gap-2">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 bg-background p-0">
						<CardTitle className="text-sm font-medium">Input</CardTitle>

						<InputActions
							isAIButtonActive={isAIButtonActive}
							aiInactiveReason={getInactiveReason()}
							isAIPopoverOpen={isPopoverOpen}
							setIsAIPopoverOpen={setIsPopoverOpen}
							aiQuery={aiQuery}
							setAiQuery={setAiQuery}
							onGenerate={handleGenerate}
							isGenerating={isLoading}
							isPreviewMode={isPreviewMode}
							onPreviewToggle={handlePreviewToggle}
							onExpandToggle={handleExpandToggle}
						/>
					</CardHeader>

					<InputContent
						ref={ref}
						value={inputContent}
						onChange={handleChange}
						onBlur={handleBlur}
						isPreviewMode={isPreviewMode}
						height={textareaHeight}
						minHeight={200}
						onResizeStart={handleResizeStart}
					/>
				</div>

				<InputExpandedDialog
					isOpen={isExpanded}
					onOpenChange={setExpanded}
					value={inputContent}
					onChange={handleChange}
					onBlur={handleBlur}
					isPreviewMode={isPreviewMode}
					onPreviewToggle={handlePreviewToggle}
					isAIButtonActive={isAIButtonActive}
					aiInactiveReason={getInactiveReason()}
					isAIPopoverOpen={isPopoverOpen}
					setIsAIPopoverOpen={setIsPopoverOpen}
					aiQuery={aiQuery}
					setAiQuery={setAiQuery}
					onGenerate={handleGenerate}
					isGenerating={isLoading}
				/>
			</>
		);
	},
);

InputTextArea.displayName = "InputTextArea";
