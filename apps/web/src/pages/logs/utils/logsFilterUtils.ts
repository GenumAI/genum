import type { DateRange } from "react-day-picker";
import { addDays, endOfDay, isSameDay } from "date-fns";

export type RangeTab = "day" | "week" | "month" | "custom";

export interface DatePresets {
	day: DateRange;
	week: DateRange;
	month: DateRange;
}

/**
 * Type guard to check if a string is a preset tab value
 */
export function isPresetTab(value: string): value is Exclude<RangeTab, "custom"> {
	return value === "day" || value === "week" || value === "month";
}

/**
 * Creates date presets based on a reference date (usually today)
 */
export function getDatePresets(referenceDate: Date): DatePresets {
	return {
		day: { from: addDays(referenceDate, -1), to: referenceDate },
		week: { from: addDays(referenceDate, -7), to: referenceDate },
		month: { from: addDays(referenceDate, -30), to: referenceDate },
	};
}

/**
 * Determines which tab corresponds to the given date range
 */
export function getTabByRange(range: DateRange | undefined, presets: DatePresets): RangeTab {
	if (!range?.from || !range?.to) return "custom";
	if (
		presets.day.from &&
		presets.day.to &&
		isSameDay(range.from, presets.day.from) &&
		isSameDay(range.to, presets.day.to)
	)
		return "day";
	if (
		presets.week.from &&
		presets.week.to &&
		isSameDay(range.from, presets.week.from) &&
		isSameDay(range.to, presets.week.to)
	)
		return "week";
	if (
		presets.month.from &&
		presets.month.to &&
		isSameDay(range.from, presets.month.from) &&
		isSameDay(range.to, presets.month.to)
	)
		return "month";
	return "custom";
}

/**
 * The window a date range asks the server for, as instants.
 *
 * The server filters `timestamp <= toDate` exactly, so `to` is widened to the end of its
 * day: the calendar hands back the local midnight that STARTS the last picked day, and a
 * preset's `to` is the moment the page opened. Sent as is, the first drops the whole last
 * day and the second drops every run made after the page was opened.
 */
export function toRequestDateRange(range?: DateRange) {
	return {
		fromDate: range?.from?.toISOString(),
		toDate: range?.to ? endOfDay(range.to).toISOString() : undefined,
	};
}
