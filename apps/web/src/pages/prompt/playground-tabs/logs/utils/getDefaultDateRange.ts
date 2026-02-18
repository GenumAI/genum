import type { DateRange } from "react-day-picker";

export function getDefaultDateRange(): DateRange {
	const todayEnd = new Date();
	todayEnd.setHours(23, 59, 59, 999);

	const twoWeeksAgoStart = new Date(todayEnd);
	twoWeeksAgoStart.setDate(twoWeeksAgoStart.getDate() - 14);
	twoWeeksAgoStart.setHours(0, 0, 0, 0);

	return {
		from: twoWeeksAgoStart,
		to: todayEnd,
	};
}
