import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
				destructive:
					"bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
				outline:
					"border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
				secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-8 rounded-md px-3 text-xs",
				lg: "h-10 rounded-md px-8",
				icon: "h-9 w-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export interface ButtonWithLoaderProps extends ButtonProps {
	isWithoutLoader?: boolean;
}

// doesn't work with TooltipTrigger asChild
const ButtonWithLoader = React.forwardRef<HTMLButtonElement, ButtonWithLoaderProps>(
	({ children, onClick, isWithoutLoader, ...props }, ref) => {
		const [isLoading, setIsLoading] = useState(false);

		const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
			if (!onClick || isLoading || props.disabled) {
				return;
			}

			setIsLoading(true);

			try {
				await onClick(event);
				setIsLoading(false);
			} catch {
				setIsLoading(false);
			}
		};

		return (
			<Button
				ref={ref}
				onClick={handleClick}
				disabled={isLoading || props.disabled}
				{...props}
			>
				{isLoading && !isWithoutLoader && <Loader2 className="animate-spin" />}
				{typeof children === "string"
					? children.charAt(0).toUpperCase() + children.slice(1).toLowerCase()
					: children}
			</Button>
		);
	},
);

ButtonWithLoader.displayName = "ButtonWithLoader";

export { Button, ButtonWithLoader, buttonVariants };
