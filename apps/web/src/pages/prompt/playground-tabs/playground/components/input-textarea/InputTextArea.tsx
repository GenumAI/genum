import { forwardRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { useInputResize } from "./hooks/useInputResize";
import { useInputGeneration } from "./hooks/useInputGeneration";
import { InputContent } from "./components/InputContent";
import { InputActions } from "./components/InputActions";
import { InputExpandedDialog } from "./components/InputExpandedDialog";
import { usePlaygroundInput } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundInput";

interface InputTextAreaProps {
	onBlur?: () => void;
	promptId?: number;
	systemPrompt?: string;
	hasPromptContent?: boolean;
}

export const InputTextArea = forwardRef<HTMLTextAreaElement, InputTextAreaProps>(
	({ onBlur, promptId, systemPrompt, hasPromptContent = false }, ref) => {
		const [searchParams] = useSearchParams();
		const testcaseId = searchParams.get("testcaseId");
		const { inputContent, setInputContent } = usePlaygroundInput({
			promptId,
			testcaseId,
		});

		// State management
		const [isExpanded, setExpanded] = useState(false);
		const [isPreviewMode, setPreviewMode] = useState(false);

		// Custom hooks
		const { textareaHeight, handleResizeStart } = useInputResize({ minHeight: 140 });
		const { aiQuery, setAiQuery, isPopoverOpen, setIsPopoverOpen, handleGenerate, isLoading } =
			useInputGeneration({
				promptId,
				systemPrompt,
				onInputGenerated: setInputContent,
			});

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

		const hasActualInput = inputContent.trim().length > 0;
		const isAIButtonActive = hasPromptContent && !hasActualInput && !!promptId;
		const isPreviewDisabled = !hasActualInput;
		
		const getInactiveReason = () => {
			if (!hasPromptContent) return "No prompt available";
			if (hasActualInput) return "Input already exists";
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
							isPreviewDisabled={isPreviewDisabled}
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
					isPreviewDisabled={isPreviewDisabled}
				/>
			</>
		);
	},
);

InputTextArea.displayName = "InputTextArea";
