import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PromptActionPopover from "@/components/PromptActionPopover";
import { TuneIcon } from "@/lib/icons/TuneIcon";

interface AIGenerateButtonProps {
	isActive: boolean;
	inactiveReason: string;
	isPopoverOpen: boolean;
	setIsPopoverOpen: (value: boolean) => void;
	aiQuery: string;
	setAiQuery: (value: string) => void;
	onGenerate: () => void;
	isLoading: boolean;
}

export const AIGenerateButton = ({
	isActive,
	inactiveReason,
	isPopoverOpen,
	setIsPopoverOpen,
	aiQuery,
	setAiQuery,
	onGenerate,
	isLoading,
}: AIGenerateButtonProps) => {
	return (
		<Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="inline-block">
							<PopoverTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 text-[#437BEF] hover:bg-accent hover:text-accent-foreground dark:hover:text-white [&_svg]:size-5 disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={!isActive}
								>
									<TuneIcon />
								</Button>
							</PopoverTrigger>
						</span>
					</TooltipTrigger>
					<TooltipContent>
						<p>{isActive ? "Generate input with AI" : inactiveReason}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<PromptActionPopover
				placeholder="What input do you need?"
				value={aiQuery}
				onChange={setAiQuery}
				onAction={onGenerate}
				buttonText="Generate"
				buttonIcon={<TuneIcon stroke="currentColor" />}
				loading={isLoading}
				disabled={isLoading}
				allowEmpty={true}
			/>
		</Popover>
	);
};
