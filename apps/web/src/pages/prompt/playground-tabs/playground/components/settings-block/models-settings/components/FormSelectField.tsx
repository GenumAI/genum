import { memo } from "react";
import { Info } from "phosphor-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getParameterDescription } from "../utils/helpers";
import type { FormSelectFieldProps } from "../utils/types";

export const FormSelectField = memo(
	({ name, label, options, disabled, control, onChange }: FormSelectFieldProps) => {
		const paramKey = name.replace(/([A-Z])/g, "_$1").toLowerCase();
		const description = getParameterDescription(paramKey);

		return (
			<FormField
				control={control}
				name={name}
				render={({ field }) => (
					<FormItem className="space-y-2">
						<div className="flex items-center gap-1">
							<FormLabel className="text-[14px] capitalize">{label}</FormLabel>
							{description && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Info
											size={14}
											className="text-muted-foreground hover:text-foreground cursor-help"
										/>
									</TooltipTrigger>
									<TooltipContent className="max-w-xs">
										<p className="text-sm">{description}</p>
									</TooltipContent>
								</Tooltip>
							)}
						</div>
						<Select
							value={field.value?.toString() || ""}
							onValueChange={(value) => {
								field.onChange(value);
								onChange?.(value);
							}}
							disabled={disabled}
						>
							<FormControl>
								<SelectTrigger>
									<SelectValue placeholder={`Select ${label}`} />
								</SelectTrigger>
							</FormControl>
							<SelectContent>
								{options.map((option) => (
									<SelectItem key={option} value={option}>
										{option}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FormMessage />
					</FormItem>
				)}
			/>
		);
	},
);

FormSelectField.displayName = "FormSelectField";
