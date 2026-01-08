import { EyeIcon, CornersOutIcon, EyeClosedIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AIGenerateButton } from "./AIGenerateButton";

interface InputActionsProps {
	// AI Button props
	isAIButtonActive: boolean;
	aiInactiveReason: string;
	isAIPopoverOpen: boolean;
	setIsAIPopoverOpen: (value: boolean) => void;
	aiQuery: string;
	setAiQuery: (value: string) => void;
	onGenerate: () => void;
	isGenerating: boolean;
	// Preview props
	isPreviewMode: boolean;
	onPreviewToggle: () => void;
	// Expand props
	onExpandToggle: () => void;
}

export const InputActions = ({
	isAIButtonActive,
	aiInactiveReason,
	isAIPopoverOpen,
	setIsAIPopoverOpen,
	aiQuery,
	setAiQuery,
	onGenerate,
	isGenerating,
	isPreviewMode,
	onPreviewToggle,
	onExpandToggle,
}: InputActionsProps) => {
	return (
		<div className="flex items-center gap-2">
			<AIGenerateButton
				isActive={isAIButtonActive}
				inactiveReason={aiInactiveReason}
				isPopoverOpen={isAIPopoverOpen}
				setIsPopoverOpen={setIsAIPopoverOpen}
				aiQuery={aiQuery}
				setAiQuery={setAiQuery}
				onGenerate={onGenerate}
				isLoading={isGenerating}
			/>

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 text-[#09090B] dark:text-[#FAFAFA] [&_svg]:size-3"
							onClick={onPreviewToggle}
						>
							{isPreviewMode ? (
								<EyeClosedIcon style={{ width: "17px", height: "17px" }} />
							) : (
								<EyeIcon style={{ width: "17px", height: "17px" }} />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Show Preview</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 text-[#09090B] dark:text-[#FAFAFA] [&_svg]:size-3"
							onClick={onExpandToggle}
						>
							<CornersOutIcon style={{ width: "20px", height: "20px" }} />
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Expand</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
};
