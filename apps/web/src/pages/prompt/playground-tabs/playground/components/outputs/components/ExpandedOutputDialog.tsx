import type React from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CompareDiffEditor from "@/components/ui/DiffEditor";
import type { PromptResponse } from "@/api/prompt";
import { MetricsDisplay } from "./MetricsDisplay";

interface ExpandedOutputDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	content?: PromptResponse;
	expectedMetrics?: PromptResponse;
	modifiedValue: string;
	testcaseId: string | null;
	isTestcaseLoading: boolean;
	hasValidOutput: boolean;
	onModifiedValueChange: (value: string) => void;
	onSaveModifiedValue: (value: string) => void;
	onSaveAsExpected: () => void;
	onAddTestcase: () => void;
	isRunning?: boolean;
}

export const ExpandedOutputDialog: React.FC<ExpandedOutputDialogProps> = ({
	isOpen,
	onOpenChange,
	content,
	expectedMetrics,
	modifiedValue,
	testcaseId,
	isTestcaseLoading,
	hasValidOutput,
	onModifiedValueChange,
	onSaveModifiedValue,
	onSaveAsExpected,
	onAddTestcase,
	isRunning,
}) => {
	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-6xl w-full h-[80vh] min-h-[500px] p-0 gap-0 flex flex-col">
				<div className="flex items-center justify-between p-4 border-b">
					<div className="flex items-center gap-4">
						<h2 className="text-lg font-semibold">Output</h2>
					</div>
				</div>

				<div className="grid grid-cols-1 border-b text-xs sm:grid-cols-2">
					<div className="min-w-0">
						<MetricsDisplay title="Last Output" content={content || undefined} />
					</div>

					<div className="min-w-0 border-t sm:border-l sm:border-t-0">
						<MetricsDisplay title="Expected Output" content={expectedMetrics} />
					</div>
				</div>

				<div className="output-diff-container relative flex-1 min-w-0 overflow-hidden px-4">
					<CompareDiffEditor
						original={content?.answer}
						modified={modifiedValue}
						onChange={onModifiedValueChange}
						onBlur={onSaveModifiedValue}
						className="output-diff-editor w-full min-w-0"
					/>
				</div>

				<div className="grid grid-cols-2 justify-items-end border-t border-border bg-[#FAFAFA] dark:bg-[#1A1A1A] rounded-b-[6px]">
					<div className="py-3 px-4 border-r">
						<Button
							variant="outline"
							size="sm"
							onClick={onSaveAsExpected}
							disabled={!hasValidOutput}
							className="text-[14px] h-[36px]"
						>
							Save as expected
						</Button>
					</div>

					<div className="py-3 px-4">
						{!testcaseId && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="inline-block">
											<Button
												size="sm"
												onClick={onAddTestcase}
												disabled={
													isTestcaseLoading || !modifiedValue.trim() || isRunning
												}
												className="text-[14px] h-[36px]"
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
			</DialogContent>
		</Dialog>
	);
};
