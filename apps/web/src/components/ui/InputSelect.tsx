import * as React from "react";
import { CheckIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export type SelectOption = {
	value: string;
	label: string;
	icon?: React.ComponentType<{ className?: string }>;
};

export type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export interface InputSelectProvided {
	options: SelectOption[];
	onValueChange?: (v: string) => void;
	placeholder: string;
	disabled: boolean;
	selectedValue: string;
	setSelectedValue: SetState<string>;
	isPopoverOpen: boolean;
	setIsPopoverOpen: SetState<boolean>;
	onOptionSelect: (v: string) => void;
}

export type InputSelectGroup = { label: string; options: SelectOption[] };

export const InputSelect: React.FC<{
	options?: SelectOption[];
	groups?: InputSelectGroup[];
	value?: string;
	onValueChange?: (v: string) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	style?: React.CSSProperties;
	children: (v: InputSelectProvided) => React.ReactNode;
	renderOption?: (args: {
		option: SelectOption;
		isSelected: boolean;
		onSelect: () => void;
	}) => React.ReactNode;
	listClassName?: string;
	popoverProps?: React.ComponentPropsWithoutRef<typeof PopoverContent>;
}> = ({
	options = [],
	groups,
	value = "",
	onValueChange,
	placeholder = "Select...",
	disabled = false,
	className,
	children,
	renderOption,
	listClassName,
	popoverProps,
	...restProps
}) => {
	const [selectedValue, setSelectedValue] = React.useState<string>(value);
	const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
	const [query, setQuery] = React.useState("");

	const normalize = React.useCallback((s: string) => {
		return s
			.toLowerCase()
			.replace(/[^a-z0-9]+/gi, " ")
			.replace(/\s+/g, " ")
			.trim();
	}, []);

	const truncate = React.useCallback((s: string, max = 40) => {
		if (!s) return s;
		return s.length > max ? s.slice(0, max) + "…" : s;
	}, []);

	const flatOptions = React.useMemo(() => {
		if (groups && groups.length > 0) return groups.flatMap((g) => g.options);
		return options;
	}, [groups, options]);

	const onOptionSelect = (option: string) => {
		setSelectedValue(option);
		onValueChange?.(option);
		setIsPopoverOpen(false);
	};

	React.useEffect(() => {
		if (value !== selectedValue) {
			setSelectedValue(value);
		}
	}, [value]);

	const filteredGroups: InputSelectGroup[] | null = React.useMemo(() => {
		if (!groups || groups.length === 0) return null;
		const q = normalize(query);
		if (!q) return groups;
		return groups
			.map((g) => {
				const groupLabelMatches = normalize(g.label).includes(q);
				const filteredOptions = g.options.filter(
					(o) => normalize(o.label).includes(q) || normalize(o.value).includes(q),
				);

				if (groupLabelMatches) {
					return { ...g, options: g.options };
				}

				return {
					label: g.label,
					options: filteredOptions,
				};
			})
			.filter((g) => g.options.length > 0);
	}, [groups, query, normalize]);

	const filteredOptions: SelectOption[] = React.useMemo(() => {
		if (groups && groups.length > 0) return [];
		const q = normalize(query);
		if (!q) return flatOptions;
		return flatOptions.filter(
			(o) => normalize(o.label).includes(q) || normalize(o.value).includes(q),
		);
	}, [groups, flatOptions, query, normalize]);

	const hasResults = React.useMemo(() => {
		if (groups && groups.length > 0) {
			if (!filteredGroups || filteredGroups.length === 0) return false;
			return filteredGroups.some((g) => g.options.length > 0);
		}
		return filteredOptions.length > 0;
	}, [groups, filteredGroups, filteredOptions]);

	return (
		<Popover
			open={isPopoverOpen}
			onOpenChange={(open) => {
				setIsPopoverOpen(open);
				if (!open) setQuery("");
			}}
		>
			<PopoverTrigger asChild>
				{children({
					options: flatOptions,
					onValueChange,
					placeholder,
					disabled,
					selectedValue,
					setSelectedValue,
					isPopoverOpen,
					setIsPopoverOpen,
					onOptionSelect,
				})}
			</PopoverTrigger>
			<PopoverContent
				className={cn("p-0 overflow-x-hidden w-full", className, popoverProps?.className)}
				align={popoverProps?.align ?? "start"}
				onEscapeKeyDown={() => setIsPopoverOpen(false)}
				style={{
					width: "var(--radix-popover-trigger-width)",
					...(popoverProps?.style || {}),
				}}
				{...popoverProps}
			>
				<div className="p-2">
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search..."
						className="h-10 text-sm"
					/>
				</div>
				<div
					className={cn(
						"max-h-[20rem] min-h-[10rem] overflow-y-auto overflow-x-hidden",
						listClassName,
					)}
				>
					{hasResults ? (
						groups && groups.length > 0 ? (
							filteredGroups!.map((group, gi) => (
								<div key={`group-${gi}`}>
									<div className="leading-[18px] py-0.5 px-2.5 mb-1 mx-[-4px] border-b border-muted text-[11px] text-[#71717A] font-bold">
										{group.label}
									</div>
									<div>
										{group.options.map((option) => {
											const isSelected = selectedValue === option.value;
											const onSelect = () => onOptionSelect(option.value);
											if (renderOption) {
												return (
													<React.Fragment key={option.value}>
														{renderOption({
															option,
															isSelected,
															onSelect,
														})}
													</React.Fragment>
												);
											}
											return (
												<div
													key={option.value}
													onClick={onSelect}
													className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[#F4F4F5] text-sm"
													role="option"
													aria-selected={isSelected}
												>
													<div
														className={cn(
															"mr-1 flex h-4 w-4 items-center justify-center",
															isSelected
																? "text-primary"
																: "invisible",
														)}
													>
														<CheckIcon className="w-4 h-4" />
													</div>
													{option.icon && (
														<option.icon className="w-4 h-4 mr-2 text-muted-foreground" />
													)}
													<span>{truncate(option.label)}</span>
												</div>
											);
										})}
									</div>
								</div>
							))
						) : (
							filteredOptions.map((option) => {
								const isSelected = selectedValue === option.value;
								const onSelect = () => onOptionSelect(option.value);
								if (renderOption) {
									return (
										<React.Fragment key={option.value}>
											{renderOption({ option, isSelected, onSelect })}
										</React.Fragment>
									);
								}
								return (
									<div
										key={option.value}
										onClick={onSelect}
										className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[#F4F4F5] text-sm"
										role="option"
										aria-selected={isSelected}
									>
										<div
											className={cn(
												"mr-1 flex h-4 w-4 items-center justify-center",
												isSelected ? "text-primary" : "invisible",
											)}
										>
											<CheckIcon className="w-4 h-4" />
										</div>
										{option.icon && (
											<option.icon className="w-4 h-4 mr-2 text-muted-foreground" />
										)}
										<span>{truncate(option.label)}</span>
									</div>
								);
							})
						)
					) : (
						<div className="px-3 py-2 text-sm text-muted-foreground">
							No results found.
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
};
InputSelect.displayName = "InputSelect";

export const InputSelectTrigger = React.forwardRef<
	HTMLButtonElement,
	{
		options: SelectOption[];
		placeholder: string;
		disabled: boolean;
		selectedValue: string;
		setIsPopoverOpen: SetState<boolean>;
		className?: string;
		children?: (v: SelectOption) => React.ReactNode;
		style?: React.CSSProperties;
	}
>(
	(
		{
			options,
			placeholder,
			disabled,
			selectedValue,
			setIsPopoverOpen,
			className,
			style,
			children,
		},
		ref,
	) => {
		const onTogglePopover = () => {
			setIsPopoverOpen((prev) => !prev);
		};

		const truncate = React.useCallback((s: string, max = 40) => {
			if (!s) return s;
			return s.length > max ? s.slice(0, max) + "…" : s;
		}, []);

		return (
			<Button
				ref={ref}
				onClick={onTogglePopover}
				variant="outline"
				type="button"
				disabled={disabled}
				className={cn(
					"flex h-11 w-full items-center justify-between p-1 [&_svg]:pointer-events-auto",
					"hover:bg-transparent",
					disabled && "[&_svg]:pointer-events-none",
					className,
				)}
				style={style}
			>
				{selectedValue ? (
					<div className="flex items-center justify-between w-full">
						<div className="flex flex-wrap items-center px-2">
							{[selectedValue].map((value, index) => {
								const option = options.find((o) => o.value === value);
								if (!option) {
									return <div key={`${index}-${value}`}></div>;
								}
								if (children) {
									return <div key={`${index}-${value}`}>{children(option)}</div>;
								}
								return (
									<div
										key={`${index}-${value}`}
										className={cn("text-foreground")}
									>
										{option?.icon && (
											<option.icon className="mr-1 h-3.5 w-3.5" />
										)}
										{truncate(option?.label)}
									</div>
								);
							})}
						</div>
						<div className="flex items-center justify-between">
							<ChevronDown className="h-4 mx-1 cursor-pointer text-muted-foreground" />
						</div>
					</div>
				) : (
					<div className="flex items-center justify-between w-full mx-auto">
						<span className="mx-3 text-sm text-muted-foreground">{placeholder}</span>
						<ChevronDown className="h-4 mx-1 cursor-pointer text-muted-foreground" />
					</div>
				)}
			</Button>
		);
	},
);
InputSelectTrigger.displayName = "InputSelectTrigger";
