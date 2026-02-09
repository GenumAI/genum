import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PromptActionPopover from "@/components/popovers/PromptActionPopover";
import { useAIGeneration } from "../../hooks/useAIGeneration";
import { TuneIcon } from "@/lib/icons/TuneIcon";
import { CircleNotch } from "phosphor-react";

type AIGenerateMode = "schema" | "tool" | "input" | "commit" | "prompt-generate" | "prompt-tune";

interface BaseAIGenerateButtonProps {
	mode: AIGenerateMode;
	promptId?: number | string;
}

interface AutomaticModeProps extends BaseAIGenerateButtonProps {
	mode: "schema" | "tool";
	onReceived: (data: any) => void;
	existingData?: any;
}

interface ControlledModeProps extends BaseAIGenerateButtonProps {
	mode: "input" | "commit" | "prompt-generate" | "prompt-tune";
	value: string;
	onChange: (value: string) => void;
	onAction: () => void;
	isOpen: boolean;
	setIsOpen: (value: boolean) => void;
	isLoading?: boolean;
	disabled?: boolean;
	placeholder?: string;
	buttonText?: string;
	tooltipText?: string;
	allowEmpty?: boolean;
	textareaClassName?: string;
	isActive?: boolean;
	inactiveReason?: string;
	simpleButton?: boolean;
	buttonClassName?: string;
}

type AIGenerateButtonProps = AutomaticModeProps | ControlledModeProps;

function isControlledMode(props: AIGenerateButtonProps): props is ControlledModeProps {
	return ["input", "commit", "prompt-generate", "prompt-tune"].includes(props.mode);
}

export default function AIGenerateButton(props: AIGenerateButtonProps) {
	const { mode, promptId } = props;
	const controlled = isControlledMode(props);

	const hookResult = useAIGeneration({
		mode: controlled ? "schema" : (props as AutomaticModeProps).mode,
		promptId: controlled ? undefined : promptId,
		onReceived: controlled ? () => {} : (props as AutomaticModeProps).onReceived,
	});

	const input = controlled ? props.value : hookResult.input;
	const setInput = controlled ? props.onChange : hookResult.setInput;
	const isOpen = controlled ? props.isOpen : hookResult.isOpen;
	const setIsOpen = controlled ? props.setIsOpen : hookResult.setIsOpen;
	const isLoading = controlled ? (props.isLoading ?? false) : hookResult.isLoading;

	const handleAction = controlled
		? props.onAction
		: () => hookResult.handleAction((props as AutomaticModeProps).existingData);

	const getLabel = () => {
		if (!controlled) return hookResult.label;
		switch (props.mode) {
			case "input":
				return "input";
			case "commit":
				return "commit message";
			case "prompt-generate":
				return "prompt";
			case "prompt-tune":
				return "prompt";
			default:
				return "";
		}
	};

	const label = getLabel();
	const placeholder = controlled && props.placeholder ? props.placeholder : `What ${label} do you need?`;
	const buttonText = controlled && props.buttonText ? props.buttonText : "Generate";
	const tooltipText = controlled && props.tooltipText ? props.tooltipText : `Generate ${label} with AI`;
	const allowEmpty = controlled ? props.allowEmpty ?? false : false;
	const textareaClassName = controlled ? props.textareaClassName ?? "" : "";

	const isInputMode = mode === "input";
	const isActive = isInputMode && controlled ? props.isActive ?? true : true;
	const inactiveReason = isInputMode && controlled ? props.inactiveReason ?? "" : "";

	const isDisabled = controlled ? props.disabled ?? false : false;
	const simpleButton = controlled && props.simpleButton;
	const buttonClassName = controlled && props.buttonClassName ? props.buttonClassName : "";

	if (simpleButton) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							aria-label={tooltipText}
							className={buttonClassName || "p-1.5 rounded-md transition-all hover:bg-[#437BEF]/10 text-[#437BEF] disabled:opacity-50 disabled:cursor-not-allowed"}
							disabled={isDisabled}
							onClick={handleAction}
						>
					{isLoading ? (
						<CircleNotch size={18} className="animate-spin" />
					) : (
						<TuneIcon stroke="currentColor" />
					)}
						</button>
					</TooltipTrigger>
					<TooltipContent>
						<p>{tooltipText}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<Popover open={isOpen} onOpenChange={setIsOpen}>
					<PopoverTrigger asChild>
						<TooltipTrigger asChild>
							{isInputMode ? (
								<span className="inline-block">
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6 text-[#437BEF] hover:bg-accent hover:text-accent-foreground dark:hover:text-white [&_svg]:size-5 disabled:opacity-50 disabled:cursor-not-allowed"
										disabled={!isActive}
									>
										<TuneIcon />
									</Button>
								</span>
							) : (
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 text-[#437BEF] hover:bg-accent hover:text-accent-foreground dark:hover:text-white [&_svg]:size-5"
									onClick={() => setIsOpen(!isOpen)}
								>
									<TuneIcon stroke="currentColor" />
								</Button>
							)}
						</TooltipTrigger>
					</PopoverTrigger>
					<TooltipContent>
						<p>{isInputMode && !isActive ? inactiveReason : tooltipText}</p>
					</TooltipContent>
					<PromptActionPopover
						placeholder={placeholder}
						value={input}
						onChange={setInput}
						onAction={handleAction}
						buttonText={buttonText}
						buttonIcon={<TuneIcon stroke="currentColor" />}
						loading={isLoading}
						disabled={isDisabled || isLoading || (!allowEmpty && !input.trim())}
						allowEmpty={allowEmpty}
						textareaClassName={textareaClassName}
					/>
				</Popover>
			</Tooltip>
		</TooltipProvider>
	);
}
