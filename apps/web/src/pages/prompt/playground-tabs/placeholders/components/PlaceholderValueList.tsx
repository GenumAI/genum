import { PlusCircleIcon, StarIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PromptPlaceholderValue } from "@/api/prompt/placeholder.api";

interface PlaceholderValueListProps {
	values: PromptPlaceholderValue[];
	hasSelectedPlaceholder: boolean;
	selectedValueId: number | undefined;
	isLoading?: boolean;
	/** Read-only reuse on the commit page -- see PlaceholderList's own note. */
	readOnly?: boolean;
	onSelect: (id: number) => void;
	onRequestNew?: () => void;
	emptyLabel?: string;
	noSelectionLabel?: string;
}

export default function PlaceholderValueList({
	values,
	hasSelectedPlaceholder,
	selectedValueId,
	isLoading = false,
	readOnly = false,
	onSelect,
	onRequestNew,
	emptyLabel = "No values yet.",
	noSelectionLabel = "Select a placeholder to see its values.",
}: PlaceholderValueListProps) {
	return (
		<div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-3">
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Values
				</h3>
				{!readOnly && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="h-7 px-2 text-xs"
						onClick={onRequestNew}
						disabled={!hasSelectedPlaceholder}
					>
						<PlusCircleIcon className="mr-1 h-4 w-4" />
						New value
					</Button>
				)}
			</div>

			{!hasSelectedPlaceholder ? (
				<div className="flex min-h-[160px] items-center justify-center text-center text-xs text-muted-foreground">
					{noSelectionLabel}
				</div>
			) : isLoading ? (
				// Loading is not emptiness -- the placeholders query still being in flight
				// must never render as "no values yet", the same defect that was already
				// fixed once for PlaceholderList and the chips.
				<div className="flex min-h-[160px] items-center justify-center text-center text-xs text-muted-foreground">
					Loading values…
				</div>
			) : values.length === 0 ? (
				<div className="flex min-h-[160px] items-center justify-center text-center text-xs text-muted-foreground">
					{emptyLabel}
				</div>
			) : (
				<div className="flex flex-col gap-1">
					{values.map((value) => {
						const isSelected = value.id === selectedValueId;
						return (
							<button
								key={value.id}
								type="button"
								onClick={() => onSelect(value.id)}
								className={cn(
									"flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60",
									isSelected && "bg-muted",
								)}
							>
								<span className="min-w-0 flex-1 truncate font-medium text-foreground">
									{value.name}
								</span>
								{value.isDefault && (
									<Badge variant="secondary" className="shrink-0 gap-1">
										<StarIcon className="h-3 w-3" weight="fill" />
										Default
									</Badge>
								)}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
