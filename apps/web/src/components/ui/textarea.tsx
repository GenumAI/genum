import * as React from "react";
import { cn } from "@/lib/utils";
import { useLayoutEffect, useRef } from "react";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
	({ className, ...props }, ref) => {
		return (
			<textarea
				className={cn(
					"flex min-h-[60px] w-full rounded-md border border-input bg-[hsl(var(--field-background))] px-3 py-2 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground md:text-sm",
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);
Textarea.displayName = "Textarea";

const AutoResizableTextarea = React.forwardRef<
	HTMLTextAreaElement,
	React.ComponentProps<"textarea"> & {
		maxRows?: number;
	}
>(({ style, className, onChange, value, maxRows = 5, ...props }, ref) => {
	const innerRef = useRef<HTMLTextAreaElement>(null);

	const combinedRef = React.useCallback(
		(node: HTMLTextAreaElement | null) => {
			innerRef.current = node;
			if (typeof ref === "function") {
				ref(node);
			} else if (ref) {
				ref.current = node;
			}
		},
		[ref],
	);

	const adjustHeight = () => {
		if (innerRef.current) {
			const computedStyle = window.getComputedStyle(innerRef.current);
			const lhString = computedStyle.lineHeight;
			let lh = parseFloat(lhString);

			if (lhString === "normal" || isNaN(lh)) {
				const fontSize = parseFloat(computedStyle.fontSize);
				lh = fontSize * 1.2;
			}

			innerRef.current.style.height = "auto";
			const currentScrollHeight = innerRef.current.scrollHeight;
			const maxHeight = maxRows * lh;

			if (currentScrollHeight > maxHeight) {
				innerRef.current.style.height = `${maxHeight}px`;
				innerRef.current.style.overflowY = "auto";
			} else {
				innerRef.current.style.height = `${currentScrollHeight}px`;
				innerRef.current.style.overflowY = "hidden";
			}
		}
	};

	useLayoutEffect(() => {
		adjustHeight();
	}, [value]);

	const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		if (onChange) {
			onChange(event);
		}
		adjustHeight();
	};

	return (
		<Textarea
			ref={combinedRef}
			onChange={handleChange}
			value={value}
			rows={1}
			style={{
				overflow: "hidden",
				resize: "none",

				...style,
			}}
			className={className}
			{...props}
		></Textarea>
	);
});

AutoResizableTextarea.displayName = "AutoResizableTextarea";

export { Textarea, AutoResizableTextarea };
