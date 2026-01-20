import { memo } from "react";
import { Info } from "phosphor-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Slider } from "@/components/ui/Slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getParameterDescription } from "../utils/helpers";
import type { FormSliderProps } from "../utils/types";

export const FormSlider = memo(
	({ name, label, min, max, step, disabled, control }: FormSliderProps) => {
		const paramKey = name.replace(/([A-Z])/g, "_$1").toLowerCase();
		const description = getParameterDescription(paramKey);

		return (
			<FormField
				control={control}
				name={name}
				render={({ field }) => {
					const backendValue = field.value;
					let currentValue: number;

					if (backendValue !== null && backendValue !== undefined) {
						currentValue = Number(backendValue);
					} else {
						currentValue = 0;
					}

					return (
						<FormItem className="space-y-2.5">
							<div className="flex justify-between items-center">
								<div className="flex items-center gap-1">
									<FormLabel className="text-[12px]">{label}</FormLabel>
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
								<span className="text-[12px] text-muted-foreground">
									{currentValue}
								</span>
							</div>
							<FormControl>
								<Slider
									max={max}
									min={min}
									step={step}
									value={[currentValue]}
									onValueChange={(values) => {
										const newValue = values[0];
										field.onChange(newValue);
									}}
									disabled={disabled}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					);
				}}
			/>
		);
	},
);

FormSlider.displayName = "FormSlider";
