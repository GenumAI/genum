import type React from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import CompareDiffEditor from "@/components/ui/DiffEditor";
import { DiffStatBadge } from "./DiffStatBadge";
import { cn } from "@/lib/utils";

interface CompareSectionProps {
	title: string;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	added: number;
	removed: number;
	changed: boolean;
	originalValue: string;
	modifiedValue: string;
	language: "json" | "markdown";
	theme: string;
}

const DEFAULT_MONACO_OPTIONS = {
	renderSideBySide: true,
	enableSplitViewResizing: false,
	readOnly: true,
	domReadOnly: true,
	originalEditable: false,
	useInlineViewWhenSpaceIsLimited: false,
	scrollBeyondLastLine: false,
	wordWrap: "on" as const,
	automaticLayout: true,
	scrollbar: {
		vertical: "auto" as const,
		horizontal: "auto" as const,
		verticalScrollbarSize: 5,
	},
	glyphMargin: true,
	ignoreTrimWhitespace: false,
	lineNumbers: "on" as const,
	contextmenu: false,
	lineNumbersMinChars: 1,
	lineDecorationsWidth: 10,
	renderOverviewRuler: true,
	renderIndicators: false,
	overviewRulerBorder: false,
	minimap: { enabled: false },
	folding: false,
	fontFamily: "Inter, sans-serif",
	fontSize: 14,
	renderGutterMenu: false,
	stickyScroll: {
		enabled: false,
	},
	padding: { top: 0, bottom: 0 },
	lineHeight: 18,
};

export const CompareSection: React.FC<CompareSectionProps> = ({
	title,
	isOpen,
	onOpenChange,
	added,
	removed,
	changed,
	originalValue,
	modifiedValue,
	language,
	theme,
}) => {
	return (
		<Collapsible
			open={isOpen}
			onOpenChange={onOpenChange}
			className="rounded-lg"
		>
			<CollapsibleTrigger asChild>
				<div>
					<button
						type="button"
						className="bg-transparent flex w-full items-center justify-between py-3 text-left"
					>
						<span className="flex items-center gap-3 text-sm font-[500]">
							{title.replaceAll("_", " ")}
							{changed && <DiffStatBadge added={added} removed={removed} />}
						</span>
						<ChevronDown
							className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
						/>
					</button>
				</div>
			</CollapsibleTrigger>
			<CollapsibleContent asChild>
				<div className="pb-3">
					<CompareDiffEditor
						className="DiffEditor border border-muted rounded-md"
						language={language}
						theme={theme}
						maxHeight={600}
						options={DEFAULT_MONACO_OPTIONS}
						original={originalValue}
						modified={modifiedValue}
					/>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
};
