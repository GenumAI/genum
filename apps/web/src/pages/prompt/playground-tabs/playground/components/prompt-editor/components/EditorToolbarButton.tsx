import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ReactNode } from "react";

interface EditorToolbarButtonProps {
	icon: ReactNode;
	tooltip: string;
	onClick: () => void;
	className?: string;
	disabled?: boolean;
	showTooltip?: boolean;
}

export const EditorToolbarButton = ({
	icon,
	tooltip,
	onClick,
	className = "h-6 w-6",
	disabled = false,
	showTooltip = true,
}: EditorToolbarButtonProps) => {
	const button = (
		<Button
			variant="ghost"
			size="icon"
			className={className}
			onClick={onClick}
			onMouseDown={(e) => e.preventDefault()}
			disabled={disabled}
		>
			{icon}
		</Button>
	);

	if (!showTooltip) {
		return button;
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>{button}</TooltipTrigger>
				<TooltipContent>
					<p>{tooltip}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};
