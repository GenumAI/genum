import { memo, useMemo } from "react";
import { FormSlider } from "./FormSlider";
import { FormSelectField } from "./FormSelectField";
import { snakeToCamel, isModelSettingKey } from "../utils/helpers";
import type { ParameterFieldsProps } from "../utils/types";

interface ParameterConfig {
	min?: number;
	max?: number;
	default?: number | string;
	allowed?: string[];
}

export const ParameterFields = memo(
	({ parameters, excludedParams, disabled, control, onFormChange }: ParameterFieldsProps) => {
		const parameterEntries = useMemo(() => {
			return Object.entries(parameters || {}).filter(
				([paramKey]) => !excludedParams.includes(paramKey),
			);
		}, [parameters, excludedParams]);

		const getSliderStep = (paramKey: string): number => {
			const isMaxTokens = paramKey === "max_tokens";
			const isNumeric = [
				"frequency_penalty",
				"presence_penalty",
				"top_p",
				"temperature",
			].includes(paramKey);
			return isMaxTokens ? 1 : isNumeric ? 0.01 : 1;
		};

		return (
			<>
				{parameterEntries.map(([paramKey, paramCfg]) => {
					const config = paramCfg as ParameterConfig;
					const camelName = snakeToCamel(paramKey);

					// Validate that this parameter is a known form field
					if (!isModelSettingKey(camelName)) {
						return null;
					}

					const label = paramKey
						.replace(/_/g, " ")
						.replace(/\b\w/g, (char) => char.toUpperCase());

					// Select field for allowed values
					if (config?.allowed && Array.isArray(config.allowed)) {
						return (
							<FormSelectField
								key={paramKey}
								control={control}
								name={camelName}
								label={label}
								options={config.allowed}
								disabled={disabled}
								onChange={onFormChange}
							/>
						);
					}

					// Slider field for min/max values
					if (config?.min !== undefined && config?.max !== undefined) {
						return (
							<FormSlider
								key={paramKey}
								control={control}
								name={camelName}
								label={label}
								min={config.min}
								max={config.max}
								step={getSliderStep(paramKey)}
								disabled={disabled}
							/>
						);
					}

					return null;
				})}
			</>
		);
	},
);

ParameterFields.displayName = "ParameterFields";
