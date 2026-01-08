import React from "react";
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
}

export const OutputActions: React.FC<OutputActionsProps> = ({
	hasValidOutput,
	testcaseId,
	isTestcaseLoading,
	modifiedValue,
	onSaveAsExpected,
	onAddTestcase,
}) => {
	return (
		<div className="grid grid-cols-2 justify-items-end">
			<div className="pt-3">
				<Button
					variant="outline"
					size="sm"
					onClick={onSaveAsExpected}
					disabled={!hasValidOutput}
					className="text-[14px] h-[32px] w-[138px]"
				>
					Save as expected
				</Button>
			</div>

			<div className="pt-3 px-0">
				{!testcaseId && (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="inline-block">
									<Button
										size="sm"
										onClick={onAddTestcase}
										disabled={isTestcaseLoading || !modifiedValue.trim()}
										className="text-[14px] h-[32px] w-[138px]"
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
