import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipArrow = React.forwardRef<
	React.ElementRef<typeof TooltipPrimitive.Arrow>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Arrow>
>(({ className, ...props }, ref) => (
	<TooltipPrimitive.Arrow
		ref={ref}
		className={`fill-[rgba(35,35,42,.92)] dark:fill-[rgba(72,72,77,.94)] mt-[-0.5px]`}
		{...props}
	/>
));
TooltipArrow.displayName = TooltipPrimitive.Arrow.displayName;

interface TooltipContentProps
	extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
	showArrow?: boolean;
}

const TooltipContent = React.forwardRef<
	React.ElementRef<typeof TooltipPrimitive.Content>,
	TooltipContentProps
>(({ className, sideOffset = 4, showArrow = true, ...props }, ref) => {
	const [container, setContainer] = React.useState<HTMLElement | null>(null);
	React.useEffect(() => {
		setContainer(document.getElementById("app-scale"));
	}, []);

	return (
		<TooltipPrimitive.Portal container={container ?? undefined}>
			<TooltipPrimitive.Content
				ref={ref}
				sideOffset={sideOffset}
				className={cn(
					"z-[51] overflow-hidden rounded-md bg-[rgba(35,35,42,.92)] dark:bg-[rgba(72,72,77,.94)] dark:text-white p-2.5 text-sm font-medium text-background animate-in fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
					className,
				)}
				{...props}
			>
				{props.children}
				{showArrow && <TooltipArrow />}
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	);
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipArrow };
