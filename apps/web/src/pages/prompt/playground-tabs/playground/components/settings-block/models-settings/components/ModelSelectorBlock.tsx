import { memo } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Model } from "@/types/AIModel";
import { ModelSelector } from "./ModelSelector";
import type { ModelSettingsFormValues } from "../utils/types";

interface ModelSelectorBlockProps {
	models?: Model[];
	groupedModels: Record<string, Model[]>;
	selectedModelName: string;
	showStatusState?: boolean;
	onModelChange: (value: string) => void;
	disabled: boolean;
	control: UseFormReturn<ModelSettingsFormValues>["control"];
}

export const ModelSelectorBlock = memo<ModelSelectorBlockProps>(
	({
		models,
		groupedModels,
		selectedModelName,
		showStatusState,
		onModelChange,
		disabled,
		control,
	}: ModelSelectorBlockProps) => {
		return (
			<ModelSelector
				models={models}
				groupedModels={groupedModels}
				selectedModelName={selectedModelName}
				showStatusState={showStatusState}
				onModelChange={onModelChange}
				disabled={disabled}
				control={control}
			/>
		);
	},
);

ModelSelectorBlock.displayName = "ModelSelectorBlock";
