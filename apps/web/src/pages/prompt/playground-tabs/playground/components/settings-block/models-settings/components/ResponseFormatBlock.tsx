import { memo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ResponseFormatSection } from "./ResponseFormatSection";
import type { ModelSettingsFormValues } from "../utils/types";

interface ResponseFormatBlockProps {
	show: boolean;
	control: UseFormReturn<ModelSettingsFormValues>["control"];
	formatOptions: string[];
	onFormatChange: (value: string) => void;
	disabled: boolean;
	showEditSchema: boolean;
	onOpenSchemaDialog: () => void;
}

const areEqualStringArrays = (a: string[], b: string[]) => {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	return a.every((value, index) => value === b[index]);
};

export const ResponseFormatBlock = memo(
	({
		show,
		control,
		formatOptions,
		onFormatChange,
		disabled,
		showEditSchema,
		onOpenSchemaDialog,
	}: ResponseFormatBlockProps) => {
		if (!show) return null;

		return (
			<ResponseFormatSection
				control={control}
				formatOptions={formatOptions}
				onFormatChange={onFormatChange}
				disabled={disabled}
				showEditSchema={showEditSchema}
				onOpenSchemaDialog={onOpenSchemaDialog}
			/>
		);
	},
	(prev, next) => {
		return (
			prev.show === next.show &&
			prev.control === next.control &&
			prev.disabled === next.disabled &&
			prev.showEditSchema === next.showEditSchema &&
			prev.onFormatChange === next.onFormatChange &&
			prev.onOpenSchemaDialog === next.onOpenSchemaDialog &&
			areEqualStringArrays(prev.formatOptions, next.formatOptions)
		);
	},
);

ResponseFormatBlock.displayName = "ResponseFormatBlock";
