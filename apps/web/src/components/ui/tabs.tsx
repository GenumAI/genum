import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { forwardRef, useEffect, useRef, useState } from "react";

const Tabs = TabsPrimitive.Root;

type TRect = {
	width: number;
	height: number;
	left: number;
};

const TabsList = forwardRef<
	React.ElementRef<typeof TabsPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
	const [activeTabRect, setActiveTabRect] = useState<TRect | null>(null);
	const [listRect, setListRect] = useState<TRect | null>(null);
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const updateActiveTabPosition = () => {
			if (!listRef.current) return;

			const listElement = listRef.current;
			const activeTab = listElement.querySelector('[data-state="active"]') as HTMLElement;

			if (activeTab) {
				const listRect = listElement.getBoundingClientRect();
				const activeRect = activeTab.getBoundingClientRect();
				const center = activeRect.left - listRect.left + activeRect.width / 2 - 4;

				const width = activeTab.offsetWidth;
				setListRect(listRect);
				setActiveTabRect({
					width,
					height: activeRect.height,
					left: center,
				});
			}
			};

		updateActiveTabPosition();

		const observer = new MutationObserver(updateActiveTabPosition);
		if (listRef.current) {
			observer.observe(listRef.current, {
				attributes: true,
				subtree: true,
				attributeFilter: ["data-state"],
			});
		}

		window.addEventListener("resize", updateActiveTabPosition);

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateActiveTabPosition);
		};
	}, []);

	const getIndicatorStyle = () => {
		if (!activeTabRect || !listRect) return { opacity: 0 };

		return {
			opacity: 1,
			width: `${activeTabRect.width}px`,
			maxWidth: `${activeTabRect.width}px`,
			height: `${activeTabRect.height}px`,
			transform: `translateX(${activeTabRect.left}px) translateX(-50%)`,
		};
	};

	return (
		<TabsPrimitive.List
			ref={(node) => {
				listRef.current = node;
				if (typeof ref === "function") {
					ref(node);
				} else if (ref) {
					ref.current = node;
				}
			}}
			className={cn(
				"relative inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground",
				className,
			)}
			{...props}
		>
			<div
				className="absolute rounded-md bg-background shadow transition-all duration-200 ease-out"
				style={getIndicatorStyle()}
			/>
			<div className="relative z-10 flex">{props.children}</div>
		</TabsPrimitive.List>
	);
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = forwardRef<
	React.ElementRef<typeof TabsPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Trigger
		ref={ref}
		className={cn(
			"inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground",
			className,
		)}
		{...props}
	/>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = forwardRef<
	React.ElementRef<typeof TabsPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Content
		ref={ref}
		className={cn(
			"mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
			className,
		)}
		{...props}
	/>
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
