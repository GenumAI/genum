import { memo } from "react";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TooltipArrow } from "@radix-ui/react-tooltip";
import { InputSelect, InputSelectTrigger } from "@/components/ui/InputSelect";
import type { Model } from "@/types/AIModel";
import type { UseFormReturn } from "react-hook-form";
import { formatVendorName } from "../utils/helpers";
import { ModelTooltipContent } from "./ModelTooltipContent";
import type { ModelSettingsFormValues } from "../utils/types";

interface ModelSelectorProps {
	models?: Model[];
	groupedModels: Record<string, Model[]>;
	selectedModelName: string;
	onModelChange: (value: string) => void;
	disabled?: boolean;
	control: UseFormReturn<ModelSettingsFormValues>["control"];
}

export const ModelSelector = memo(
	({
		models,
		groupedModels,
		selectedModelName,
		onModelChange,
		disabled,
		control,
	}: ModelSelectorProps) => {
		return (
			<FormField
				control={control}
				name="selectedModel"
				render={() => (
					<FormItem className="space-y-2">
						<FormLabel className="text-[14px] flex items-center gap-1">Model</FormLabel>
						<InputSelect
							value={selectedModelName}
							onValueChange={onModelChange}
							disabled={disabled}
							groups={Object.entries(groupedModels).map(([vendor, vendorModels]) => {
								const sorted = [...vendorModels].sort((a, b) => {
									const nameA = a.displayName || a.name;
									const nameB = b.displayName || b.name;
									return nameA.localeCompare(nameB, undefined, {
										sensitivity: "base",
									});
								});
								return {
									label: formatVendorName(vendor),
									options: sorted.map((model) => ({
										value: model.name,
										label: model.displayName || model.name,
									})),
								};
							})}
							placeholder="Select a model to continue"
							className={`mt-1 text-[14px] ${!selectedModelName ? "border-red-500" : ""}`}
							popoverProps={{
								side: "bottom",
								avoidCollisions: false,
								sideOffset: 4,
								align: "start",
							}}
							renderOption={({ option, isSelected, onSelect }) => {
								const model = models?.find((m) => m.name === option.value);
								const label =
									option.label && option.label.length > 40
										? `${option.label.slice(0, 40)}…`
										: option.label;
								return (
									<Tooltip key={option.value}>
										<TooltipTrigger asChild>
											<div
												onClick={onSelect}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														onSelect();
													}
												}}
												className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted"
												role="option"
												aria-selected={isSelected}
												tabIndex={0}
											>
												<span>{label}</span>
											</div>
										</TooltipTrigger>
										{model && (
											<TooltipContent side="right" align="start">
												<TooltipArrow />
												<ModelTooltipContent model={model} />
											</TooltipContent>
										)}
									</Tooltip>
								);
							}}
						>
							{({
								options,
								placeholder,
								disabled,
								selectedValue,
								setIsPopoverOpen,
							}) => (
								<InputSelectTrigger
									options={options}
									placeholder={placeholder}
									disabled={disabled}
									selectedValue={selectedValue}
									setIsPopoverOpen={setIsPopoverOpen}
									className={`mt-1 text-[14px] dark:border-[#3C3D3F] h-9 ${!selectedModelName ? "border-red-500" : ""}`}
								/>
							)}
						</InputSelect>
						<FormMessage />
						{!selectedModelName && (
							<p className="text-[12px] text-red-500">
								Please select a model before running the prompt
							</p>
						)}
					</FormItem>
				)}
			/>
		);
	},
);

ModelSelector.displayName = "ModelSelector";
