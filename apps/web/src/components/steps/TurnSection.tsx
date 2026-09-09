import { type ReactNode, useState } from "react";

import { CaretRight } from "@phosphor-icons/react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface TurnSectionProps {
	/** 1-based position among the turns rendered, for the header's "Turn N". */
	turnNumber: number;
	/**
	 * Steps in this turn the session actually reaches. `null` means none of them do --
	 * the whole turn sits after the cut -- and the header says so instead of printing a
	 * count that would read as "this turn ran" when it never did.
	 */
	liveStepCount: number | null;
	totalStepCount: number;
	/** This turn has a row the last run's comparison marked mismatched. */
	hasMismatch?: boolean;
	/** This turn holds the reply that ends the session -- the live control, not a dead row. */
	isCutTurn?: boolean;
	children: ReactNode;
}

/**
 * One turn, collapsed to a single header line by default -- the point of grouping,
 * since a five-turn session of tool calls is otherwise a wall. The header itself is the
 * trigger and stays visible however the turn is collapsed, so a turn that needs
 * attention keeps saying so even when the author closes it: a turn that collapses a red
 * mark out of sight is worse than no collapsing. `open`'s initial value, not `open`
 * itself, reads `hasMismatch`/`isCutTurn` -- once the author has toggled a turn by hand,
 * a later re-render (a save landing, a mismatch clearing) must not silently reopen or
 * reclose it out from under them.
 */
export function TurnSection({
	turnNumber,
	liveStepCount,
	totalStepCount,
	hasMismatch = false,
	isCutTurn = false,
	children,
}: TurnSectionProps) {
	const [open, setOpen] = useState(hasMismatch || isCutTurn);

	return (
		<Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex w-full items-center gap-1 bg-transparent text-left"
				>
					<CaretRight
						className={cn(
							"shrink-0 text-muted-foreground transition-transform",
							open && "rotate-90",
						)}
						size={12}
					/>
					<span
						className={cn(
							"font-medium text-xs",
							hasMismatch ? "text-destructive" : "text-muted-foreground",
						)}
					>
						Turn {turnNumber} ·{" "}
						{liveStepCount === null
							? "not reached"
							: `${liveStepCount} ${liveStepCount === 1 ? "step" : "steps"}${
									liveStepCount === totalStepCount ? "" : ` of ${totalStepCount}`
								}`}
						{hasMismatch ? " · mismatch" : ""}
						{isCutTurn ? " · ends here" : ""}
					</span>
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent className="flex flex-col gap-3 pl-4">{children}</CollapsibleContent>
		</Collapsible>
	);
}
