import type React from "react";
import { CornersOut } from "phosphor-react";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MemoryKey from "../../../../memory/MemoryKey";
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
	onExpand: () => void;
}

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
	onExpand,
}) => {
	return (
		<div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 pb-2 pt-4">
			<div className="min-w-0">
				<CardTitle className="text-sm font-medium">Output</CardTitle>
			</div>
			<div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
				{promptId && <MemoryKey promptId={promptId} />}

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

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 shrink-0 text-[#09090B] dark:text-[#FAFAFA] [&_svg]:size-3"
								onClick={onExpand}
							>
								<CornersOut style={{ width: "20px", height: "20px" }} />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Expand</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
		</div>
	);
};
