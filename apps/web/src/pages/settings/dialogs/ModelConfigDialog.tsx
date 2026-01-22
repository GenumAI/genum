import * as React from "react";

import { useToast } from "@/hooks/useToast";
import { organizationApi } from "@/api/organization";
import type { LanguageModel, ModelParameterConfig } from "@/api/organization";
import {
	getModelConfigValidationState,
	getModelParamBounds,
	getModelParamDefaultOnBlur,
	getNextModelParameterConfig,
} from "@/pages/settings/dialogs/utils/validator";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

const DEFAULT_PARAMETERS: Record<string, ModelParameterConfig> = {
	temperature: {
		enabled: false,
		min: 0,
		max: 2,
		default: 0.7,
	},
	max_tokens: {
		enabled: false,
		min: 1,
		max: 128000,
		default: 4096,
	},
	response_format: {
		enabled: false,
		allowed: ["text", "json_object", "json_schema"],
		default: "text",
	},
	tools: {
		enabled: false,
	},
};

interface ModelConfigDialogProps {
	model: LanguageModel;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved: () => void;
}

export default function ModelConfigDialog({
	model,
	open,
	onOpenChange,
	onSaved,
}: ModelConfigDialogProps) {
	const { toast } = useToast();
	const [isSaving, setIsSaving] = React.useState(false);
	const [displayName, setDisplayName] = React.useState(model.displayName || model.name);
	const [parametersConfig, setParametersConfig] = React.useState<
		Record<string, ModelParameterConfig>
	>(() => {
		const existing = (model.parametersConfig as Record<string, ModelParameterConfig>) || {};
		const merged = { ...DEFAULT_PARAMETERS };
		for (const [key, value] of Object.entries(existing)) {
			const fallback = DEFAULT_PARAMETERS[key] || { enabled: false };
			merged[key] = {
				...fallback,
				...value,
				enabled: value.enabled ?? true,
			};
		}
		return merged;
	});
	const [openItems, setOpenItems] = React.useState<string[]>([]);
	const [hasEmptyField, setHasEmptyField] = React.useState(false);
	const [hasEmptyResponseFormat, setHasEmptyResponseFormat] = React.useState(false);
	const [hasInvalidTokenRange, setHasInvalidTokenRange] = React.useState(false);
	const [hasInvalidTemperatureRange, setHasInvalidTemperatureRange] = React.useState(false);
	const [validationRequested, setValidationRequested] = React.useState(false);

	React.useEffect(() => {
		setDisplayName(model.displayName || model.name);
		const existing = (model.parametersConfig as Record<string, ModelParameterConfig>) || {};
		const merged = { ...DEFAULT_PARAMETERS };
		for (const [key, value] of Object.entries(existing)) {
			const fallback = DEFAULT_PARAMETERS[key] || { enabled: false };
			merged[key] = {
				...fallback,
				...value,
				enabled: value.enabled ?? true,
			};
		}
		setParametersConfig(merged);
		const enabledKeys = Object.entries(merged)
			.filter(([, config]) => config.enabled)
			.map(([paramName]) => paramName);
		setOpenItems(enabledKeys);
	}, [model]);

	React.useEffect(() => {
		const {
			hasEmptyField,
			hasEmptyResponseFormat,
			hasInvalidTokenRange,
			hasInvalidTemperatureRange,
		} =
			getModelConfigValidationState(parametersConfig);
		setHasEmptyField(hasEmptyField);
		setHasEmptyResponseFormat(hasEmptyResponseFormat);
		setHasInvalidTokenRange(hasInvalidTokenRange);
		setHasInvalidTemperatureRange(hasInvalidTemperatureRange);
	}, [parametersConfig]);

	const toggleParameter = (paramName: string) => {
		setParametersConfig((prev) => ({
			...prev,
			[paramName]: {
				...prev[paramName],
				enabled: !prev[paramName].enabled,
			},
		}));
	};

	const updateParameterValue = (
		paramName: string,
		field: keyof ModelParameterConfig,
		value: number | string,
	) => {
		setParametersConfig((prev) => ({
			...prev,
			[paramName]: getNextModelParameterConfig(paramName, prev[paramName], field, value),
		}));
	};

	const toggleAllowedValue = (paramName: string, value: string) => {
		setParametersConfig((prev) => {
			const current = prev[paramName];
			const allowed = new Set(current.allowed ?? []);
			if (allowed.has(value)) {
				allowed.delete(value);
			} else {
				allowed.add(value);
			}

			const nextAllowed = Array.from(allowed);
			const defaultValue =
				typeof current.default === "string" && nextAllowed.includes(current.default)
					? current.default
					: nextAllowed[0] ?? "text";

			return {
				...prev,
				[paramName]: {
					...current,
					allowed: nextAllowed,
					default: defaultValue,
				},
			};
		});
	};

	const handleSave = async () => {
		try {
			setValidationRequested(true);
			if (hasEmptyField) {
				toast({
					title: "Error",
					description: "Field cannot be empty",
					variant: "destructive",
				});
				return;
			}

			const responseFormatConfig = parametersConfig.response_format;
			if (
				responseFormatConfig?.enabled &&
				Array.isArray(responseFormatConfig.allowed) &&
				responseFormatConfig.allowed.length === 0
			) {
				toast({
					title: "Error",
					description: "Response Format can not be empty",
					variant: "destructive",
				});
				return;
			}
			if (hasInvalidTokenRange) {
				toast({
					title: "Error",
					description: "Min Tokens cannot be greater than Max Tokens",
					variant: "destructive",
				});
				return;
			}
			if (hasInvalidTemperatureRange) {
				toast({
					title: "Error",
					description: "Min Temperature cannot be greater than Max Temperature",
					variant: "destructive",
				});
				return;
			}
			setIsSaving(true);

			const enabledConfig: Record<string, ModelParameterConfig> = {};
			for (const [key, config] of Object.entries(parametersConfig)) {
				if (config.enabled) {
					enabledConfig[key] = config;
				}
			}

			await organizationApi.updateCustomModel(model.id, {
				displayName: displayName.trim() || model.name,
				parametersConfig: enabledConfig,
			});

			toast({ title: "Success", description: "Model configuration saved" });
			onSaved();
			onOpenChange(false);
		} catch (e) {
			console.error(e);
			toast({
				title: "Error",
				description: "Failed to save configuration",
				variant: "destructive",
			});
		} finally {
			setIsSaving(false);
		}
	};

	const parameterLabels: Record<string, string> = {
		temperature: "Temperature",
		max_tokens: "Max Tokens",
		response_format: "Response Format",
		tools: "Tools",
	};
	const parameterValueLabels: Record<string, string> = {
		json_object: "json_obj",
	};
	const responseFormatOptions = ["text", "json_object", "json_schema"];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Configure Model: {model.name}</DialogTitle>
					<DialogDescription>
						Select which parameters this model supports and configure their limits.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					<div className="space-y-2">
						<Label>Display Name</Label>
						<Input
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							placeholder={model.name}
						/>
					</div>

					<div className="space-y-4">
						<Label className="text-base font-medium">Supported Parameters</Label>

						<Accordion
							type="multiple"
							className="space-y-3"
							value={openItems}
							onValueChange={setOpenItems}
						>
							{Object.entries(parametersConfig).map(([paramName, config]) => (
								<AccordionItem
									key={paramName}
									value={paramName}
									className="border rounded-md px-4"
								>
									<AccordionTrigger
										className="hover:no-underline"
									>
										<div
											className="flex items-center gap-3"
											onPointerDown={(event) => event.stopPropagation()}
										>
											<Checkbox
												id={`param-${paramName}`}
												checked={config.enabled}
												onCheckedChange={() => toggleParameter(paramName)}
												onPointerDown={(event) => event.stopPropagation()}
												onClick={(event) => event.stopPropagation()}
											/>
											<span className="font-medium cursor-pointer text-left">
												{parameterLabels[paramName] || paramName}
											</span>
										</div>
									</AccordionTrigger>
									<AccordionContent className="pb-4">
										<div className="pl-7 space-y-4">
											{config.allowed ? (
												<div className="space-y-3">
													<div className="flex flex-wrap gap-3">
														{responseFormatOptions.map((val) => (
															<div
																key={val}
																className="flex items-center gap-2 text-sm"
															>
																<Checkbox
																	id={`param-${paramName}-${val}`}
																	checked={(config.allowed ?? []).includes(val)}
																	onCheckedChange={() =>
																		toggleAllowedValue(paramName, val)
																	}
																	disabled={!config.enabled}
																/>
																<label
																	htmlFor={`param-${paramName}-${val}`}
																	className="cursor-pointer"
																>
																	{parameterValueLabels[val] ?? val}
																</label>
															</div>
														))}
													</div>

													<div className="space-y-1 max-w-[240px]">
														<Label className="text-sm text-muted-foreground">
															Default
														</Label>
														<Select
															value={String(config.default ?? "text")}
															onValueChange={(value) =>
																updateParameterValue(paramName, "default", value)
															}
															disabled={!config.enabled}
														>
															<SelectTrigger className="text-[14px]">
																<SelectValue placeholder="Select default" />
															</SelectTrigger>
															<SelectContent>
																{(config.allowed ?? []).map((val) => (
																	<SelectItem key={val} value={val}>
																		{parameterValueLabels[val] ?? val}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
												</div>
											) : paramName === "temperature" ||
											  paramName === "max_tokens" ||
											  config.min !== undefined ||
											  config.max !== undefined ||
											  typeof config.default === "number" ? (
												<div className="grid grid-cols-3 gap-3">
													<div className="space-y-1">
														<Label className="text-sm text-muted-foreground">
															Min
														</Label>
														<Input
															type="number"
															value={config.min ?? ""}
															onChange={(e) =>
																updateParameterValue(
																	paramName,
																	"min",
																	e.target.value === ""
																		? ""
																		: Number(e.target.value),
																)
															}
															min={0}
															max={getModelParamBounds(paramName)?.max}
															disabled={!config.enabled}
															className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-ring"
														/>
													</div>
													<div className="space-y-1">
														<Label className="text-sm text-muted-foreground">
															Max
														</Label>
														<Input
															type="number"
															value={config.max ?? ""}
															onChange={(e) =>
																updateParameterValue(
																	paramName,
																	"max",
																	e.target.value === ""
																		? ""
																		: Number(e.target.value),
																)
															}
															min={0}
															max={getModelParamBounds(paramName)?.max}
															disabled={!config.enabled}
															className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-ring"
														/>
													</div>
													<div className="space-y-1">
														<Label className="text-sm text-muted-foreground">
															Default
														</Label>
														<Input
															type="number"
															value={
																typeof config.default === "number"
																	? config.default
																	: config.default === ""
																		? ""
																		: 0
															}
															onChange={(e) =>
																updateParameterValue(
																	paramName,
																	"default",
																	e.target.value === ""
																		? ""
																		: Number(e.target.value),
																)
															}
															onBlur={() => {
																setParametersConfig((prev) => {
																	const current = prev[paramName];
																	const nextDefault =
																		getModelParamDefaultOnBlur(
																			paramName,
																			current,
																		);
																	if (
																		nextDefault === undefined ||
																		nextDefault === current.default
																	) {
																		return prev;
																	}
																	return {
																		...prev,
																		[paramName]: {
																			...current,
																			default: nextDefault,
																		},
																	};
																});
															}}
															min={
																getModelParamBounds(paramName)
																	? typeof config.min === "number"
																		? config.min
																		: getModelParamBounds(paramName)?.min
																	: 0
															}
															max={
																getModelParamBounds(paramName)
																	? typeof config.max === "number"
																		? config.max
																		: getModelParamBounds(paramName)?.max
																	: undefined
															}
															disabled={!config.enabled}
															className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-ring"
														/>
													</div>
												</div>
											) : (
												<span className="text-sm text-muted-foreground">
													No extra settings
												</span>
											)}
										</div>
									</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={
							isSaving ||
							(validationRequested &&
								(hasEmptyResponseFormat ||
									hasInvalidTokenRange ||
									hasInvalidTemperatureRange))
						}
					>
						{isSaving ? "Saving..." : "Save Configuration"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
