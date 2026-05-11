import { CircleAlert, CircleCheck, CirclePlus } from "lucide-react";
import clsx from "clsx";
import type { TestStatus } from "@/types/TestСase";

export const getTestCaseIcon = (type: TestStatus, count = 1) => {
	const grayClass = "text-muted-foreground";
	const iconSize = "w-4 h-4";

	const colorClass =
		count > 0
			? {
					OK: "text-success",
					NOK: "text-destructive",
					NEED_RUN: "text-warning",
				}[type]
			: grayClass;

	switch (type) {
		case "OK":
			return <CircleCheck className={clsx(iconSize, colorClass)} />;
		case "NOK":
			return <CirclePlus className={clsx(iconSize, "transform rotate-45", colorClass)} />;
		case "NEED_RUN":
			return <CircleAlert className={clsx(iconSize, colorClass)} />;
		default:
			return null;
	}
};
