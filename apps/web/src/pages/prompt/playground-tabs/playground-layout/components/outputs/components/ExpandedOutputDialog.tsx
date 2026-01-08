import type React from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CompareDiffEditor from "@/components/ui/DiffEditor";
import type { PromptResponse } from "@/hooks/useRunPrompt";
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
	onSaveModifiedValue: (value: string) => void;
	onSaveAsExpected: () => void;
	onAddTestcase: () => void;
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
	onSaveModifiedValue,
	onSaveAsExpected,
	onAddTestcase,
}) => {
	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-6xl w-full h-[80vh] min-h-[500px] p-0 gap-0 flex flex-col">
				<div className="flex items-center justify-between p-4 border-b">
					<div className="flex items-center gap-4">
						<h2 className="text-lg font-semibold">Output</h2>
					</div>
				</div>

				<div className="grid grid-cols-2 text-xs border-b">
					<div>
						<MetricsDisplay title="Last Output" content={content || undefined} />
					</div>

					<div>
						<MetricsDisplay title="Expected Output" content={expectedMetrics} />
					</div>
				</div>

				<div className="flex-1 px-4">
					<CompareDiffEditor
						original={content?.answer}
						modified={modifiedValue}
						onBlur={onSaveModifiedValue}
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
													isTestcaseLoading || !modifiedValue.trim()
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
