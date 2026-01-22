import type { ChangeEvent } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/useToast";
import AIPreview from "@/pages/prompt/playground-tabs/playground/components/input-textarea/components/AIPreview";
import { InputActions } from "./InputActions";

interface InputExpandedDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	value: string;
	onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
	onBlur?: () => void;
	isPreviewMode: boolean;
	onPreviewToggle: () => void;
	// AI props
	isAIButtonActive: boolean;
	aiInactiveReason: string;
	isAIPopoverOpen: boolean;
	setIsAIPopoverOpen: (value: boolean) => void;
	aiQuery: string;
	setAiQuery: (value: string) => void;
	onGenerate: () => void;
	isGenerating: boolean;
	isPreviewDisabled?: boolean;
}

export const InputExpandedDialog = ({
	isOpen,
	onOpenChange,
	value,
	onChange,
	onBlur,
	isPreviewMode,
	onPreviewToggle,
	isAIButtonActive,
	aiInactiveReason,
	isAIPopoverOpen,
	setIsAIPopoverOpen,
	aiQuery,
	setAiQuery,
	onGenerate,
	isGenerating,
	isPreviewDisabled = false,
}: InputExpandedDialogProps) => {
	const { toast } = useToast();

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent
				onEscapeKeyDown={(e) => e.preventDefault()}
				className="flex h-[80vh] w-full max-w-4xl flex-col py-6 px-4"
			>
				<div className="flex h-full flex-col gap-2">
					<div className="flex items-center gap-2">
						<h3 className="text-sm font-medium">Input</h3>
						<InputActions
							isAIButtonActive={isAIButtonActive}
							aiInactiveReason={aiInactiveReason}
							isAIPopoverOpen={isAIPopoverOpen}
							setIsAIPopoverOpen={setIsAIPopoverOpen}
							aiQuery={aiQuery}
							setAiQuery={setAiQuery}
							onGenerate={onGenerate}
							isGenerating={isGenerating}
							isPreviewMode={isPreviewMode}
							onPreviewToggle={onPreviewToggle}
							isPreviewDisabled={isPreviewDisabled}
							onExpandToggle={() => onOpenChange(false)}
						/>
					</div>
					<div className="flex-grow overflow-auto">
						{isPreviewMode ? (
							<div className="h-full overflow-y-auto rounded-md border bg-transparent p-4 text-sm dark:border-border">
								<AIPreview
									content={value}
									onError={(error) => {
										toast({
											title: "Preview Error",
											description: error,
											variant: "destructive",
										});
									}}
								/>
							</div>
						) : (
							<Textarea
								value={value}
								onChange={onChange}
								onBlur={onBlur}
								placeholder="Enter your input here..."
								className="h-full resize-y text-[14px] dark:bg-[#1E1E1E] dark:border-border focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 md:text-[14px]"
							/>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
