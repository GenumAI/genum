import type React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OutputActionsProps {
	hasValidOutput: boolean;
	testcaseId: string | null;
	isTestcaseLoading: boolean;
	modifiedValue: string;
	onSaveAsExpected: () => void;
	onAddTestcase: () => void;
	isRunning?: boolean;
}

export const OutputActions: React.FC<OutputActionsProps> = ({
	hasValidOutput,
	testcaseId,
	isTestcaseLoading,
	modifiedValue,
	onSaveAsExpected,
	onAddTestcase,
	isRunning,
}) => {
	return (
		<div className="grid w-full min-w-0 grid-cols-1 gap-2 pt-3 sm:grid-cols-2">
			<div className="flex items-center justify-end">
				<Button
					variant="outline"
					size="sm"
					onClick={onSaveAsExpected}
					disabled={!hasValidOutput}
					className="h-[32px] w-full text-[14px] sm:w-[138px]"
				>
					Save as expected
				</Button>
			</div>

			<div className="flex items-center justify-end">
				{!testcaseId && (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="inline-block w-full sm:w-auto">
									<Button
										size="sm"
										onClick={onAddTestcase}
										disabled={isTestcaseLoading || !modifiedValue.trim() || isRunning}
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
