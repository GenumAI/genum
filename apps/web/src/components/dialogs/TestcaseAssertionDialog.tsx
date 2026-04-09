import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
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
			return <CircleCheck className="text-success" />;
		case "NOK":
			return <CirclePlus className="transform rotate-45 text-destructive" />;
		case "NEED_RUN":
			return <CircleAlert className="text-warning" />;
		default:
			return null;
	}
};

export const getTestCaseStatusIcon = (type: string) => {
	if (type?.toLowerCase().includes("ok")) {
		return <CircleCheck className="min-w-[16px] text-success" />;
	} else if (type?.toLowerCase().includes("nok") || type?.toLowerCase().includes("fail")) {
		return <CirclePlus className="min-w-[16px] rotate-45 transform text-destructive" />;
	} else if (
		type?.toLowerCase().includes("need_run") ||
		type?.toLowerCase().includes("pending")
	) {
		return <CircleAlert className="min-w-[16px] text-warning" />;
	} else {
		return <CircleAlert className="min-w-[16px] text-muted-foreground" />;
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
	const currentAssertionType = assertionType ?? "AI";
	const hasAssertionThoughts =
		testcase.assertionThoughts && testcase.assertionThoughts.trim().length > 0;
	const showAssertionFields =
		hasAssertionThoughts && (currentAssertionType === "AI" || currentAssertionType === "STRICT");

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Testcase Assertion</DialogTitle>
					<DialogDescription className="sr-only">
						Details for the selected testcase assertion.
					</DialogDescription>
				</DialogHeader>

				<div>
					<div className="flex justify-start gap-2 items-center text-[14px] h-[30px]">
						<span className="font-semibold">Status</span>
						<span className="flex flex-row items-center gap-1 [&_svg]:size-4">
							{getTestCaseIcon(testcase.status as TestStatus)}
							<span className="text-muted-foreground">
								{getTestCaseTooltip(testcase.status as TestStatus)}
							</span>
						</span>
					</div>

					<Separator className="my-2" />

					{status && (
						<>
							<div className="flex justify-start gap-2 items-center text-[14px] min-h-[30px]">
								<span className="font-semibold">Prompt Run Status</span>
								<span className="flex flex-row items-center gap-1 text-foreground [&_svg]:size-4">
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
								`${currentAssertionType === "STRICT"
									? "rounded-xl bg-chart-2 text-primary-foreground dark:text-white"
									: currentAssertionType === "MANUAL"
										? "rounded-xl bg-chart-7 text-primary-foreground"
										: currentAssertionType === "AI"
											? "rounded-xl bg-[hsl(var(--ai-tag))] text-primary-foreground dark:text-white"
											: "rounded-xl bg-muted text-foreground"} border-none`
							}
						>
							{currentAssertionType}
						</Badge>
					</div>

					{showAssertionFields && (
						<div className="mt-4 flex flex-col gap-2 text-[14px]">
							<label className="font-semibold" htmlFor="assertion-thoughts">Reasoning</label>
							<Textarea
								id="assertion-thoughts"
								value={testcase.assertionThoughts}
								readOnly
								tabIndex={-1}
								className="h-[100px] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none outline-none shadow-none"
							/>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button onClick={onClose}>OK</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
