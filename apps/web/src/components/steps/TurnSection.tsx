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
 * One turn, collapsible to a single header line -- an affordance for a long session, not
 * a default that hides the author's own data. Every turn starts OPEN: a freshly pinned,
 * never-run trajectory and a single-turn recorded log both need every step visible on
 * first render, and nothing here can tell "long session, collapse for space" apart from
 * "nothing to see yet" well enough to guess a better default. The header itself is the
 * trigger and stays visible however the turn is collapsed, so a turn the author DOES
 * close by hand still says whether it holds a mismatch or the cut -- a turn that
 * collapses a red mark out of sight is worse than no collapsing.
 *
 * The content stays mounted even while closed (`forceMount`, not Radix's default
 * unmount-on-close): a `final` row's editable text buffers an uncommitted draft in local
 * state, and collapsing the turn must not be a way to lose it. Rendering hidden content
 * still costs a render, which is fine at the scale a session's step count reaches; it is
 * not fine to make "the author closed this turn" a data-loss event.
 *
 * The closed state is hidden by swapping `flex` for `hidden` IN THE CLASSNAME, not by the
 * native `hidden` attribute: this project's Tailwind preflight declares `[hidden]` without
 * `!important`, so on an element that also carries a `display` utility, source order (not
 * the semantics of the attribute) decides which wins -- and `.flex` came out ahead here,
 * making the attribute a no-op that left the content on screen, in the tab order, and in
 * the accessibility tree while "collapsed". Never applying `flex` and `hidden` to the same
 * element at once removes the tie entirely.
 */
export function TurnSection({
	turnNumber,
	liveStepCount,
	totalStepCount,
	hasMismatch = false,
	isCutTurn = false,
	children,
}: TurnSectionProps) {
	const [open, setOpen] = useState(true);

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
			<CollapsibleContent
				forceMount
				className={cn(open ? "flex flex-col gap-3 pl-4" : "hidden")}
			>
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}
