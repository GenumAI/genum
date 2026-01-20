import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CircleAlert, CircleCheck, CirclePlus } from "lucide-react";

import type { TestCase, TestStatus } from "@/types/TestСase";
import type { PromptSettings } from "@/types/Prompt";

interface TestcaseAssertionModalProps {
	open: boolean;
	onClose: () => void;
	testcase: TestCase;
	status?: string;
	assertionType?: PromptSettings["assertionType"];
}

export const getTestCaseIcon = (type: TestStatus) => {
	switch (type) {
		case "OK":
			return <CircleCheck className="text-[#2E9D2A]" />;
		case "NOK":
			return <CirclePlus className="text-[#FF4545] transform rotate-45" />;
		case "NEED_RUN":
			return <CircleAlert className="text-[#FAAD15]" />;
		default:
			return null;
	}
};

export const getTestCaseStatusIcon = (type: string) => {
	if (type?.toLowerCase().includes("ok")) {
		return <CircleCheck className="text-[#2E9D2A] min-w-[16px]" />;
	} else if (type?.toLowerCase().includes("nok") || type?.toLowerCase().includes("fail")) {
		return <CirclePlus className="text-[#FF4545] min-w-[16px] transform rotate-45" />;
	} else if (
		type?.toLowerCase().includes("need_run") ||
		type?.toLowerCase().includes("pending")
	) {
		return <CircleAlert className="text-[#FAAD15] min-w-[16px]" />;
	} else {
		return <CircleAlert className="text-gray-400 min-w-[16px]" />;
	}
};

export const getTestCaseTooltip = (type: TestStatus) => {
	switch (type) {
		case "OK":
			return "Pass";
		case "NOK":
			return "Failed";
		case "NEED_RUN":
			return "Need run";
		default:
			return null;
	}
};

export const TestcaseAssertionModal = ({
	open,
	onClose,
	testcase,
	status,
	assertionType,
}: TestcaseAssertionModalProps) => {
	const currentAssertionType = assertionType || "AI";
	const hasAssertionThoughts = testcase.assertionThoughts && testcase.assertionThoughts.trim().length > 0;
	const showAssertionFields = hasAssertionThoughts && (currentAssertionType === "AI" || currentAssertionType === "STRICT");

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Testcase Assertion</DialogTitle>
				</DialogHeader>

				<div>
					<div className="flex justify-start gap-2 items-center text-[14px] h-[30px]">
						<span className="font-semibold">Status</span>
						<span className="[&_svg]:size-4 flex flex-row gap-1 items-center text-[#18181B] dark:text-muted-foreground">
							{getTestCaseIcon(testcase.status as TestStatus)}
							{getTestCaseTooltip(testcase.status as TestStatus)}
						</span>
					</div>

					<Separator className="my-2" />

					{status && (
						<>
							<div className="flex justify-start gap-2 items-center text-[14px] min-h-[30px]">
								<span className="font-semibold">Prompt Run Status</span>
								<span className="[&_svg]:size-4 flex flex-row gap-1 items-center text-[#18181B]">
									{getTestCaseStatusIcon(status)}
									{status}
								</span>
							</div>

							<Separator className="my-2" />
						</>
					)}

					<div className="flex items-center gap-2 h-[30px] text-[14px]">
						<span className="font-semibold">Assertion Type</span>
						<Badge
							className={
								(currentAssertionType === "STRICT"
									? "bg-[#2A9D90] text-white rounded-xl"
									: currentAssertionType === "MANUAL"
										? "bg-[#6C98F2] text-white rounded-xl"
										: currentAssertionType === "AI"
											? "bg-[#B66AD6] text-white rounded-xl"
											: "bg-gray-200 text-black") + " border-none"
							}
						>
							{currentAssertionType}
						</Badge>
					</div>

					{showAssertionFields && (
						<>
							<div className="mt-4 flex flex-col gap-2 text-[14px]">
								<label className="font-semibold" htmlFor="assertion-thoughts">Reasoning</label>
								<Textarea
									id="assertion-thoughts"
									value={testcase.assertionThoughts}
									readOnly
									className="h-[100px]"
								/>
							</div>
						</>
					)}
				</div>

				<DialogFooter>
					<Button onClick={onClose}>OK</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
