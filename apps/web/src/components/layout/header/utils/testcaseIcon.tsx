import { CircleAlert, CircleCheck, CirclePlus } from "lucide-react";
import clsx from "clsx";
import type { TestStatus } from "@/types/TestСase";

export const getTestCaseIcon = (type: TestStatus, count = 1) => {
	const grayClass = "text-gray-500 dark:text-[#D4D4D8]";
	const iconSize = "w-4 h-4";

	const colorClass =
		count > 0
			? {
					OK: "text-[#2E9D2A]",
					NOK: "text-[#FF4545]",
					NEED_RUN: "text-[#FAAD15]",
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
