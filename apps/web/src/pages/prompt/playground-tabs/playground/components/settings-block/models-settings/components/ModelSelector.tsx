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
	showStatusState?: boolean;
	onModelChange: (value: string) => void;
	disabled?: boolean;
	control: UseFormReturn<ModelSettingsFormValues>["control"];
}

export const ModelSelector = memo(
	({
		models,
		groupedModels,
		selectedModelName,
		showStatusState = true,
		onModelChange,
		disabled,
		control,
	}: ModelSelectorProps) => {
		const selectedModel = models?.find((m) => m.name === selectedModelName);
		const isSelectedDisabled = selectedModel?.isDisabled === true;
		const triggerOptions =
			models?.map((model) => ({
				value: model.name,
				label: model.displayName || model.name,
			})) ?? [];
		const modelCount = Object.values(groupedModels).reduce(
			(count, vendorModels) => count + vendorModels.length,
			0,
		);

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
							className={`mt-1 text-[14px] ${
								showStatusState && !selectedModelName ? "border-red-500" : ""
							}`}
							popoverProps={{
								side: "bottom",
								avoidCollisions: false,
								sideOffset: 4,
								align: "start",
							}}
							listClassName={modelCount < 5 ? "min-h-0" : undefined}
							renderOption={({ option, isSelected, onSelect }) => {
								const model = models?.find((m) => m.name === option.value);
								const isModelDisabled = model?.isDisabled === true;
								const label =
									option.label && option.label.length > 40
										? `${option.label.slice(0, 40)}…`
										: option.label;
								return (
									<Tooltip key={option.value}>
										<TooltipTrigger asChild>
											<div
												onClick={isModelDisabled ? undefined : onSelect}
												onKeyDown={(e) => {
													if (
														!isModelDisabled &&
														(e.key === "Enter" || e.key === " ")
													) {
														onSelect();
													}
												}}
												className={`flex items-center gap-2 px-2 py-1.5 text-sm ${
													isModelDisabled
														? "cursor-not-allowed opacity-50"
														: "cursor-pointer hover:bg-muted"
												}`}
												role="option"
												aria-selected={isSelected}
												aria-disabled={isModelDisabled}
												tabIndex={isModelDisabled ? -1 : 0}
											>
												<span>{label}</span>
												{isModelDisabled && (
													<span className="ml-auto text-xs text-amber-500 font-medium shrink-0">
														Disabled
													</span>
												)}
											</div>
										</TooltipTrigger>
										<TooltipContent side="right" align="start">
											<TooltipArrow />
											{isModelDisabled ? (
												<p className="text-xs max-w-[200px]">
													This model is disabled for your organization.
													Please select a different model.
												</p>
											) : (
												model && <ModelTooltipContent model={model} />
											)}
										</TooltipContent>
									</Tooltip>
								);
							}}
						>
							{({
								placeholder,
								disabled,
								selectedValue,
								setIsPopoverOpen,
							}) => (
								<InputSelectTrigger
									options={triggerOptions}
									placeholder={placeholder}
									disabled={disabled}
									selectedValue={selectedValue}
									setIsPopoverOpen={setIsPopoverOpen}
									className={`mt-1 text-[14px] dark:border-[#3C3D3F] h-9 ${
										showStatusState && (!selectedModelName || isSelectedDisabled)
											? "border-amber-500"
											: ""
									}`}
								/>
							)}
						</InputSelect>
						<FormMessage />
						{showStatusState && !selectedModelName && (
							<p className="text-[12px] text-red-500">
								Please select a model before running the prompt
							</p>
						)}
						{showStatusState && isSelectedDisabled && (
							<p className="text-[12px] text-amber-500">
								This model is disabled for your organization. Please select a
								different model.
							</p>
						)}
					</FormItem>
				)}
			/>
		);
	},
);

ModelSelector.displayName = "ModelSelector";
