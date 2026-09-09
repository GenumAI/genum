import CompareDiffEditor from "@/components/ui/DiffEditor";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface CompareDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 1-based, for the title. A dialog headed only "Output" is what made the old one
	 *  read as a second, competing surface rather than a detail of one message. */
	turnNumber: number;
	/** What the run produced for this turn. Empty when the run never reached it. */
	produced: string;
	/** The expected answer for this turn. */
	expected: string;
	/** Commits an edit made inside the dialog. Absent makes it read-only. */
	onExpectedChange?: (text: string) => void;
}

/**
 * One turn's produced answer against its expected one, per character.
 *
 * The ONLY place this surface mounts Monaco for output comparison. It used to sit open
 * at 320px under every run, holding a diff of a single hardcoded pair -- the last answer
 * against the one expected value -- which made it both the loudest element on the page
 * and the least reachable: there was no way to compare any other turn. Behind a control
 * on the message it belongs to, it can address any of them.
 */
export function CompareDialog({
	open,
	onOpenChange,
	turnNumber,
	produced,
	expected,
	onExpectedChange,
}: CompareDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[80vh] min-h-[500px] w-full max-w-6xl flex-col gap-0 p-0">
				<div className="border-b p-4">
					<h2 className="font-semibold text-lg">Turn {turnNumber}</h2>
					<p className="text-xs text-muted-foreground">
						What the run produced, against what this turn expects.
					</p>
				</div>

				<div className="output-diff-container relative min-w-0 flex-1 overflow-hidden px-4">
					<CompareDiffEditor
						original={produced}
						modified={expected}
						onChange={onExpectedChange}
						onBlur={onExpectedChange}
						surfaceToken="--background"
						className="output-diff-editor w-full min-w-0"
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
