import { CircleAlert, CircleCheck, CirclePlus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TestStatus } from "@/types/TestСase";

export const getTestCaseIcon = (type: TestStatus) => {
	switch (type) {
		case "OK":
			return <CircleCheck />;
		case "NOK":
			return <CirclePlus className="transform rotate-45" />;
		case "NEED_RUN":
			return <CircleAlert />;
		default:
			return null;
	}
};

export const getTestCaseTooltip = (type: TestStatus) => {
	switch (type) {
		case "OK":
			return "Test passed";
		case "NOK":
			return "Test failed";
		case "NEED_RUN":
			return "Need run";
		default:
			return null;
	}
};

export const getTestCaseColorClass = (type: TestStatus) => {
	switch (type) {
		case "OK":
			return "text-success";
		case "NOK":
			return "text-destructive";
		case "NEED_RUN":
			return "text-warning";
		default:
			return "text-muted-foreground";
	}
};

type Props = {
	type: TestStatus;
	value?: number | string;
};

const TestCaseStatus = ({ type, value }: Props) => {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className={`flex flex-row gap-1 items-center [&_svg]:size-4 ${Number(value) !== 0 ? getTestCaseColorClass(type) : "text-muted-foreground"}`}
					>
						{value && <span>{value}</span>}
						{getTestCaseIcon(type)}
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<p>{getTestCaseTooltip(type)}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

export default TestCaseStatus;
