import { CalendarIcon } from "lucide-react";
import { format, isBefore, isSameDay, addDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface DateRangePopoverFieldProps {
	value?: DateRange;
	onApply: (range: DateRange | undefined) => void;
}

export function DateRangePopoverField({ value, onApply }: DateRangePopoverFieldProps) {
	const [open, setOpen] = useState(false);
	const [tempValue, setTempValue] = useState<DateRange | undefined>(value);

	useEffect(() => {
		setTempValue(value);
	}, [value]);

	const displayText =
		value?.from && value?.to
			? `${format(value.from, "MMM dd, yyyy")} - ${format(value.to, "MMM dd, yyyy")}`
			: "Select a date range";

	const handleDayClick = (day: Date) => {
		if (!tempValue?.from || (tempValue.from && tempValue.to)) {
			setTempValue({ from: day, to: undefined });
		} else if (tempValue.from && !tempValue.to) {
			if (isBefore(day, tempValue.from)) {
				setTempValue({ from: day, to: tempValue.from });
			} else if (isSameDay(day, tempValue.from)) {
				setTempValue({ from: day, to: day });
			} else {
				setTempValue({ from: tempValue.from, to: day });
			}
		}
	};

	const handleClear = () => {
		const today = new Date();
		const monthAgo = addDays(today, -30);
		const defaultRange = { from: monthAgo, to: today };
		setTempValue(defaultRange);
		onApply(defaultRange);
		setOpen(false);
	};

	return (
		<div className="flex flex-row items-center">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						className={cn(
							"border rounded-md px-3 py-2 text-sm text-left flex items-center gap-2 text-muted-foreground shadow-sm transition-colors w-[245px]",
							"hover:border-muted-foreground/50",
							"truncate whitespace-nowrap overflow-hidden",
						)}
					>
						<CalendarIcon className="w-4 h-4 flex-shrink-0" />
						<span className="truncate whitespace-nowrap overflow-hidden">
							{displayText}
						</span>
					</button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-4" align="start">
					<Calendar
						mode="range"
						selected={tempValue}
						onDayClick={handleDayClick}
						numberOfMonths={2}
						initialFocus
					/>
					<div className="flex justify-between gap-2 pt-4">
						<Button variant="outline" size="default" onClick={handleClear}>
							Clear
						</Button>
						<Button
							size="default"
							onClick={() => {
								onApply(tempValue);
								setOpen(false);
							}}
							disabled={!(tempValue?.from && tempValue?.to)}
						>
							Apply
						</Button>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
