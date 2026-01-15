import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PromptActionPopover from "@/components/popovers/PromptActionPopover";
import { useAIGeneration } from "./hooks/useAIGeneration";
import { TuneIcon } from "@/lib/icons/TuneIcon";

type AIGenerateMode = "schema" | "tool";

interface AIGenerateButtonProps {
	mode: AIGenerateMode;
	promptId?: number | string;
	onReceived: (data: any) => void;
	existingData?: any;
}

export default function AIGenerateButton({
	mode,
	promptId,
	onReceived,
	existingData,
}: AIGenerateButtonProps) {
	const { input, setInput, isOpen, setIsOpen, handleAction, isLoading, label } = useAIGeneration({
		mode,
		promptId,
		onReceived,
	});

	return (
		<TooltipProvider>
			<Tooltip>
				<Popover open={isOpen} onOpenChange={setIsOpen}>
					<PopoverTrigger asChild>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 text-[#437BEF] hover:bg-accent hover:text-accent-foreground dark:hover:text-white [&_svg]:size-5"
								onClick={() => setIsOpen(!isOpen)}
							>
								<TuneIcon stroke="currentColor" />
							</Button>
						</TooltipTrigger>
					</PopoverTrigger>
					<TooltipContent>
						<p>Generate {label} with AI</p>
					</TooltipContent>
					<PromptActionPopover
						placeholder={`What ${label} do you need?`}
						value={input}
						onChange={setInput}
						onAction={() => handleAction(existingData)}
						buttonText="Generate"
						buttonIcon={<TuneIcon stroke="currentColor" />}
						loading={isLoading}
						disabled={isLoading || !input.trim()}
					/>
				</Popover>
			</Tooltip>
		</TooltipProvider>
	);
}
