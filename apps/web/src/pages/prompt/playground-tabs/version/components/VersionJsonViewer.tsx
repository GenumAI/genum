import type React from "react";
import { useState } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown, SquareTerminal, type LucideIcon } from "lucide-react";
import { JSONTree } from "react-json-tree";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";
import { jsonThemeDark, jsonThemeLight } from "../utils/utils";

interface VersionJsonViewerProps {
	title: string;
	data: any;
	icon?: LucideIcon;
	defaultOpen?: boolean;
}

export const VersionJsonViewer: React.FC<VersionJsonViewerProps> = ({
	title,
	data,
	icon: Icon = SquareTerminal,
	defaultOpen = false,
}) => {
	const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");
	const { resolvedTheme } = useTheme();
	const activeJsonTheme = resolvedTheme === "dark" ? jsonThemeDark : jsonThemeLight;

	if (!data) return null;

	return (
		<AccordionPrimitive.Root
			type="single"
			collapsible
			defaultValue={defaultOpen ? "item-1" : undefined}
			className="border border-border rounded-xl overflow-hidden"
		>
			<AccordionPrimitive.Item value="item-1">
				<AccordionPrimitive.Header>
					<AccordionPrimitive.Trigger className="group flex items-center w-full text-left text-sm font-medium text-foreground hover:underline p-3">
						<ChevronDown className="h-4 w-4 text-muted-foreground mr-2 transition-transform group-data-[state=open]:rotate-180" />
						<Icon className="h-4 w-4 mr-2" />
						<span>{title}</span>
					</AccordionPrimitive.Trigger>
				</AccordionPrimitive.Header>
				<AccordionPrimitive.Content>
					<div className="mb-4 inline-flex overflow-hidden px-4 pt-4">
						<button
							type="button"
							onClick={() => setViewMode("tree")}
							className={cn(
								"px-4 py-1.5 text-sm font-medium focus:outline-none rounded-l-md border",
								viewMode === "tree"
									? "text-foreground border-[#2b6cb0] text-[#2b6cb0]"
									: "text-muted-foreground border-border hover:bg-muted",
							)}
						>
							Tree
						</button>
						<button
							type="button"
							onClick={() => setViewMode("raw")}
							className={cn(
								"px-4 py-1.5 text-sm font-medium focus:outline-none rounded-r-md border",
								viewMode === "raw"
									? "text-foreground border-[#2b6cb0] text-[#2b6cb0]"
									: "text-muted-foreground border-border hover:bg-muted",
							)}
						>
							Raw
						</button>
					</div>

					{viewMode === "tree" ? (
						<div className="p-4 pt-0 rounded text-xs text-foreground overflow-auto">
							<JSONTree data={data} theme={activeJsonTheme} invertTheme={false} />
						</div>
					) : (
						<pre className="p-4 pt-0 rounded text-xs text-foreground overflow-auto">
							{JSON.stringify(data, null, 2)}
						</pre>
					)}
				</AccordionPrimitive.Content>
			</AccordionPrimitive.Item>
		</AccordionPrimitive.Root>
	);
};
