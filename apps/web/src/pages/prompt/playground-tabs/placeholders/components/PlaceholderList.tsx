import { CheckCircleIcon, TrashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PromptPlaceholder } from "@/api/prompt/placeholder.api";

interface PlaceholderListProps {
	placeholders: PromptPlaceholder[];
	keysInPromptText: Set<string>;
	selectedId: number | undefined;
	onSelect: (id: number) => void;
	onRequestDelete: (placeholder: PromptPlaceholder) => void;
}

export default function PlaceholderList({
	placeholders,
	keysInPromptText,
	selectedId,
	onSelect,
	onRequestDelete,
}: PlaceholderListProps) {
	if (placeholders.length === 0) {
		return (
			<div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
				No placeholders yet.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1">
			{placeholders.map((placeholder) => {
				const isSelected = placeholder.id === selectedId;
				const occursInText = keysInPromptText.has(placeholder.key);

				return (
					<div
						key={placeholder.id}
						className={cn(
							"group flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/60",
							isSelected && "bg-muted",
						)}
					>
						<button
							type="button"
							onClick={() => onSelect(placeholder.id)}
							className="flex min-w-0 flex-1 items-center gap-2 text-left"
						>
							{occursInText && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<CheckCircleIcon
												className="h-4 w-4 shrink-0 text-primary"
												weight="fill"
											/>
										</TooltipTrigger>
										<TooltipContent>
											<p>Used in the prompt text</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
							<span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
								{placeholder.key}
							</span>
							<span className="shrink-0 text-xs text-muted-foreground">
								{placeholder.values.length} value
								{placeholder.values.length === 1 ? "" : "s"}
							</span>
						</button>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
							onClick={() => onRequestDelete(placeholder)}
							aria-label={`Delete ${placeholder.key}`}
						>
							<TrashIcon className="h-4 w-4" />
						</Button>
					</div>
				);
			})}
		</div>
	);
}
