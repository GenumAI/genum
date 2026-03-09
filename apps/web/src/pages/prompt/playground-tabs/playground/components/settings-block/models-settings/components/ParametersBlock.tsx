import { memo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormSelectField } from "./FormSelectField";
import { ParameterFields } from "./ParameterFields";
import type { ModelSettingsFormValues } from "../utils/types";

interface ParametersBlockProps {
	forceRenderKey: number;
	selectedModelId: number | null;
	isCurrentModelReasoning: boolean;
	reasoningEffortOptions: string[];
	reasoningEffortDefaultValue?: string;
	disabled: boolean;
	onFormChange: (
		overrides?: Partial<ModelSettingsFormValues>,
		options?: { immediate?: boolean },
	) => void;
	parameters: Record<string, unknown>;
	excludedParams: string[];
	control: UseFormReturn<ModelSettingsFormValues>["control"];
}

const shallowRecordEqual = (a: Record<string, unknown>, b: Record<string, unknown>) => {
	if (a === b) return true;
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) return false;
	return aKeys.every((key) => a[key] === b[key]);
};

const shallowStringArrayEqual = (a: string[], b: string[]) => {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	return a.every((value, index) => value === b[index]);
};

export const ParametersBlock = memo(
	({
		isCurrentModelReasoning,
		reasoningEffortOptions,
		reasoningEffortDefaultValue,
		disabled,
		onFormChange,
		parameters,
		excludedParams,
		control,
	}: ParametersBlockProps) => {
		return (
			<div className="mt-2 space-y-5">
				{isCurrentModelReasoning && (
					<FormSelectField
						control={control}
						name="reasoningEffort"
						label="Reasoning Effort"
						options={reasoningEffortOptions}
						defaultValue={reasoningEffortDefaultValue}
						disabled={disabled}
						onChange={(name, value) =>
							onFormChange({ [name]: value }, { immediate: true })
						}
					/>
				)}

				<ParameterFields
					parameters={parameters}
					excludedParams={excludedParams}
					disabled={disabled}
					control={control}
					onFormChange={onFormChange}
				/>
			</div>
		);
	},
	(prev, next) => {
		return (
			prev.forceRenderKey === next.forceRenderKey &&
			prev.selectedModelId === next.selectedModelId &&
			prev.isCurrentModelReasoning === next.isCurrentModelReasoning &&
			shallowStringArrayEqual(prev.reasoningEffortOptions, next.reasoningEffortOptions) &&
			prev.reasoningEffortDefaultValue === next.reasoningEffortDefaultValue &&
			prev.disabled === next.disabled &&
			prev.onFormChange === next.onFormChange &&
			shallowRecordEqual(prev.parameters, next.parameters) &&
			shallowStringArrayEqual(prev.excludedParams, next.excludedParams) &&
			prev.control === next.control
		);
	},
);

ParametersBlock.displayName = "ParametersBlock";
