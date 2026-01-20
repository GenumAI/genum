import { memo } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import type { UseFormReturn } from "react-hook-form";
import type { ModelSettingsFormValues } from "../utils/types";

interface ResponseFormatSectionProps {
	control: UseFormReturn<ModelSettingsFormValues>["control"];
	formatOptions: string[];
	onFormatChange: (value: string) => void;
	disabled?: boolean;
	showEditSchema: boolean;
	onOpenSchemaDialog: () => void;
}

export const ResponseFormatSection = memo(
	({
		control,
		formatOptions,
		onFormatChange,
		disabled,
		showEditSchema,
		onOpenSchemaDialog,
	}: ResponseFormatSectionProps) => {
		return (
			<>
				<FormField
					control={control}
					name="responseFormat"
					render={({ field }) => (
						<FormItem className="space-y-2">
							<FormLabel className="text-[14px]">Response Format</FormLabel>
							<Select
								value={field.value || ""}
								onValueChange={(value) => {
									field.onChange(value);
									onFormatChange(value);
								}}
								disabled={disabled}
							>
								<FormControl>
									<SelectTrigger
										id="response-format"
										className="mt-1 text-[14px] dark:bg-transparent dark:border-[#3C3D3F]"
									>
										<SelectValue placeholder={field.value} />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{formatOptions.map((format: string) => (
										<SelectItem key={format} value={format}>
											{format}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>

				{showEditSchema && (
					<Button
						variant="secondary"
						size="sm"
						className="w-full self-start px-1 py-1 gap-1 transition-colors mt-2"
						type="button"
						onClick={onOpenSchemaDialog}
						disabled={disabled}
					>
						Edit Schema
					</Button>
				)}
			</>
		);
	},
);

ResponseFormatSection.displayName = "ResponseFormatSection";
