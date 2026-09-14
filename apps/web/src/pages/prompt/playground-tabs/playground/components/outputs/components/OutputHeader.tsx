import type React from "react";
import { CornersOut } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePromptStatus } from "@/contexts/PromptStatusContext";
import { cn } from "@/lib/utils";
import { AssertionPanel } from "./AssertionPanel";

interface OutputHeaderProps {
	promptId?: number;
	currentAssertionType: string;
	assertionValue: string;
	isOpenAssertion: boolean;
	onOpenAssertionChange: (open: boolean) => void;
	onAssertionTypeChange: (value: string) => void;
	onAssertionValueChange: (value: string) => void;
	onAssertionValueBlur: (value: string) => void;
	setAssertionValue: (value: string) => void;
	toast: any;
}

/**
 * Which version of the prompt a run here used.
 *
 * A run and a replay both read the prompt's LIVE draft -- deliberately, because the reason
 * to replay pinned sessions is to check an edit before committing it. External traffic
 * runs against the latest commit instead. So when the draft has uncommitted changes, a
 * replay is not a reproduction of the recorded run, and nothing on the page said so: the
 * author read a red testcase as a regression when they were looking at their own unsaved
 * edit.
 */
const RunVersionBadge: React.FC = () => {
	const { isCommitted } = usePromptStatus();

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<span
						className={cn(
							"cursor-default rounded-full border px-2 py-0.5 text-xs",
							isCommitted
								? "text-muted-foreground"
								: "border-amber-500/40 text-amber-600 dark:text-amber-400",
						)}
					>
						{isCommitted ? "Committed" : "Draft"}
					</span>
				</TooltipTrigger>
				<TooltipContent className="max-w-xs">
					{isCommitted
						? "Runs here use this prompt's committed version — the same one the API serves."
						: "Runs here use the current draft, which has uncommitted changes. The API serves the last commit, so a result may differ from production."}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

export const OutputHeader: React.FC<OutputHeaderProps> = ({
	promptId,
	currentAssertionType,
	assertionValue,
	isOpenAssertion,
	onOpenAssertionChange,
	onAssertionTypeChange,
	onAssertionValueChange,
	onAssertionValueBlur,
	setAssertionValue,
	toast,
}) => {
	return (
		<div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 pb-2 pt-4">
			<div className="flex min-w-0 items-center gap-2">
				<CardTitle className="text-sm font-medium">Output</CardTitle>
				<RunVersionBadge />
			</div>
			<div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
				<AssertionPanel
					currentAssertionType={currentAssertionType}
					assertionValue={assertionValue}
					promptId={promptId}
					isOpen={isOpenAssertion}
					onOpenChange={onOpenAssertionChange}
					onAssertionTypeChange={onAssertionTypeChange}
					onAssertionValueChange={onAssertionValueChange}
					onAssertionValueBlur={onAssertionValueBlur}
					setAssertionValue={setAssertionValue}
					toast={toast}
				/>
			</div>
		</div>
	);
};
