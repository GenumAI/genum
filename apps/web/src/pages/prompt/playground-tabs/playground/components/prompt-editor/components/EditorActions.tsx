import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AIGenerateButton from "../../settings-block/models-settings/components/ai-interface-editor/shared/code-editor/components/AIGenerateButton";
import { CircleNotchIcon, ChartBarIcon } from "@phosphor-icons/react";
import Brush from "@/assets/brush.svg";
import { cn } from "@/lib/utils";

interface EditorActionsProps {
	main?: boolean;
	editorIsEmpty: boolean;
	// Audit props
	onAuditPrompt?: () => void;
	onOpenAuditModal?: () => void;
	isAuditLoading?: boolean;
	canAudit?: boolean;
	auditRate?: number;
	// Generate props
	promptText?: string;
	setPromptText?: (value: string) => void;
	handleGenerate?: () => void;
	isGeneratePopoverOpen: boolean;
	setIsGeneratePopoverOpen: (value: boolean) => void;
	// Tune props
	tuneText?: string;
	setTuneText?: (value: string) => void;
	handleTune?: () => void;
	isTunePopoverOpen: boolean;
	setIsTunePopoverOpen: (value: boolean) => void;
	// Clear props
	clearContent?: () => void;
	// Loading
	loading?: boolean;
}

export const EditorActions = ({
	main,
	editorIsEmpty,
	onAuditPrompt,
	onOpenAuditModal,
	isAuditLoading = false,
	canAudit = false,
	auditRate,
	promptText = "",
	setPromptText = () => {},
	handleGenerate = () => {},
	isGeneratePopoverOpen,
	setIsGeneratePopoverOpen,
	tuneText = "",
	setTuneText = () => {},
	handleTune = () => {},
	isTunePopoverOpen,
	setIsTunePopoverOpen,
	clearContent = () => {},
	loading = false,
}: EditorActionsProps) => {
	const handleAuditClick = () => {
		if (auditRate !== undefined && onOpenAuditModal) {
			onOpenAuditModal();
		} else if (onAuditPrompt) {
			onAuditPrompt();
		}
	};

	return (
		<div className="flex items-center gap-3">
			{/* Audit Button */}
			{main && (onAuditPrompt || onOpenAuditModal) && (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								onClick={handleAuditClick}
								disabled={!canAudit || isAuditLoading}
								className={cn(
									"border-[#437BEF] dark:border-[#437BEF] bg-transparent text-[#437BEF] [&_svg]:size-3 hover:text-[#437BEF] text-[10px] gap-0.5 px-[10px] h-[20px]",
									auditRate !== undefined ? "cursor-pointer" : "",
								)}
							>
								{isAuditLoading ? (
									<CircleNotchIcon className="h-3 w-3 animate-spin" />
								) : (
									<></>
								)}
								{typeof auditRate === "number" ? (
									<>
										<ChartBarIcon className="h-4 w-4" />
										Score {auditRate}/100
									</>
								) : (
									"Audit"
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>
								{auditRate !== undefined
									? "View audit results"
									: "Analyze prompt logic"}
							</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)}

		{/* Generate Button */}
		{editorIsEmpty && main && (
			<AIGenerateButton
				mode="prompt-generate"
				value={promptText}
				onChange={setPromptText}
				onAction={handleGenerate}
				isOpen={isGeneratePopoverOpen}
				setIsOpen={setIsGeneratePopoverOpen}
				isLoading={loading}
				placeholder="What would you like to generate?"
				buttonText="Generate"
				tooltipText="Generate prompt"
			/>
		)}

		{/* Tune Button */}
		{!editorIsEmpty && main && (
			<AIGenerateButton
				mode="prompt-tune"
				value={tuneText}
				onChange={setTuneText}
				onAction={handleTune}
				isOpen={isTunePopoverOpen}
				setIsOpen={setIsTunePopoverOpen}
				isLoading={loading}
				placeholder="What would you like to tune?"
				buttonText="Tune"
				tooltipText="Tune prompt"
				textareaClassName="text-primary"
			/>
		)}

			{/* Clear Button */}
			{!editorIsEmpty && !main && (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 [&_svg]:size-4"
								onClick={clearContent}
								onMouseDown={(e) => e.preventDefault()}
							>
								<Brush />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Clear content</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)}
		</div>
	);
};
