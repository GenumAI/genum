import type React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OutputActionsProps {
	testcaseId: string | null;
	isTestcaseLoading: boolean;
	modifiedValue: string;
	onAddTestcase: () => void;
	isRunning?: boolean;
}

export const OutputActions: React.FC<OutputActionsProps> = ({
	testcaseId,
	isTestcaseLoading,
	modifiedValue,
	onAddTestcase,
	isRunning,
}) => {
	// "Save as expected" moved onto the answer it saves: with a turn each having its own
	// expectation, a single button at the bottom of the page could only ever address one
	// of them, and never said which.
	return (
		<div className="flex w-full min-w-0 justify-end pt-3">
			<div className="flex items-center justify-end">
				{!testcaseId && (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="inline-block w-full sm:w-auto">
									<Button
										size="sm"
										onClick={onAddTestcase}
										disabled={
											isTestcaseLoading || !modifiedValue.trim() || isRunning
										}
										className="h-[32px] w-full text-[14px] sm:w-[138px]"
									>
										{isTestcaseLoading && (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										)}
										Add testcase
									</Button>
								</div>
							</TooltipTrigger>
							<TooltipContent>
								<p>Click to add a new test case</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}
			</div>
		</div>
	);
};
