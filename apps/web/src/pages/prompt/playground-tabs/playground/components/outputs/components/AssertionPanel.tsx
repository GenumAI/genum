import type React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { capitalizeFirstLetter } from "@/lib/capitalizeFirstLetter";
import AssertionPopover from "@/components/popovers/AssertionPopover";
import clsx from "clsx";

interface AssertionPanelProps {
	currentAssertionType: string;
	assertionValue: string;
	promptId?: number;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onAssertionTypeChange: (value: string) => void;
	onAssertionValueChange: (value: string) => void;
	onAssertionValueBlur: (value: string) => void;
	setAssertionValue: (value: string) => void;
	toast: any;
}

export const AssertionPanel: React.FC<AssertionPanelProps> = ({
	currentAssertionType,
	assertionValue,
	promptId,
	isOpen,
	onOpenChange,
	onAssertionTypeChange,
	onAssertionValueChange,
	onAssertionValueBlur,
	setAssertionValue,
	toast,
}) => {
	return (
		<Popover open={isOpen} onOpenChange={onOpenChange}>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<PopoverTrigger asChild>
							<button type="button" className="w-[120px] h-[32px] px-3 rounded-md transition-colors flex items-center justify-start gap-2 hover:bg-muted/50 ml-[15px]">
								<h2 className="text-[#18181B] dark:text-[#FFFFFF] text-[12px] font-bold flex-shrink-0">
									Assertion:
								</h2>
								<div
									className={clsx(
										"rounded-xl flex items-center justify-center h-4 text-[12px] font-[600] text-white flex-shrink-0",
										{
											"bg-[#2A9D90] w-[56px]": currentAssertionType === "STRICT",
											"bg-[#B66AD6] w-[56px]": currentAssertionType === "AI",
										},
									)}
								>
									{currentAssertionType !== "AI"
										? capitalizeFirstLetter(currentAssertionType)
										: currentAssertionType}
								</div>
							</button>
						</PopoverTrigger>
					</TooltipTrigger>
					<TooltipContent>
						<p>Choose validation type</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<PopoverContent className="w-[400px] rounded-xl p-4" align="start">
				<div className="space-y-3">
					<h3 className="text-[#18181B] dark:text-[#FFFFFF] font-sans text-[14px] font-bold mb-4">
						Assertion
					</h3>

					<Select value={currentAssertionType} onValueChange={onAssertionTypeChange}>
						<SelectTrigger className="text-[#18181B] dark:text-[#FFFFFF] text-[14px] font-normal leading-[20px] w-full">
							<SelectValue placeholder="AI" />
						</SelectTrigger>
						<SelectContent className="text-[#18181B] dark:text-[#FFFFFF] text-[14px] font-normal leading-[20px] w-full">
							<SelectItem value="STRICT">Strict</SelectItem>
							<SelectItem value="AI">AI</SelectItem>
						</SelectContent>
					</Select>

					<div className="space-y-2">
						{currentAssertionType === "AI" && (
							<div className="flex items-center justify-between">
								<span className="font-sans text-[12px] not-italic font-medium leading-[12px] text-[#18181B] dark:text-[#FFFFFF]">
									Value
								</span>
								{promptId && (
									<AssertionPopover
										promptId={promptId}
										setAssertionValue={setAssertionValue}
										toast={toast}
									/>
								)}
							</div>
						)}
						{currentAssertionType === "AI" && (
							<Textarea
								className="text-[14px] font-normal leading-[20px] w-full min-h-[180px] max-h-[300px]"
								placeholder="Enter assertion"
								value={assertionValue}
								onChange={(e) => onAssertionValueChange(e.target.value)}
								onBlur={(e) => {
									onAssertionValueBlur(e.target.value);
								}}
							/>
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
};
