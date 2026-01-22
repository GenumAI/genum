import type { ModelParameterConfig } from "@/api/organization";

const clampNumber = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));
const clampNumberOptional = (value: number, min: number, max?: number) =>
	max === undefined ? Math.max(min, value) : clampNumber(value, min, max);

const modelParamNumericBounds: Record<string, { min: number; max?: number }> = {
	temperature: { min: 0, max: 2 },
	max_tokens: { min: 0 },
};

export const getModelParamBounds = (paramName: string) => modelParamNumericBounds[paramName];

export const getNextModelParameterConfig = (
	paramName: string,
	current: ModelParameterConfig,
	field: keyof ModelParameterConfig,
	value: ModelParameterConfig[keyof ModelParameterConfig],
): ModelParameterConfig => {
	const bounds = getModelParamBounds(paramName);
	if (bounds) {
		const next = { ...current };
		if (field === "min") {
			if (value === "") {
				next.min = undefined;
			} else if (typeof value === "number") {
				next.min = Number.isFinite(value)
					? clampNumberOptional(value, bounds.min, bounds.max)
					: bounds.min;
			}
		} else if (field === "max") {
			if (value === "") {
				next.max = undefined;
			} else if (typeof value === "number") {
				next.max = Number.isFinite(value)
					? clampNumberOptional(value, bounds.min, bounds.max)
					: bounds.min;
			}
			} else if (field === "default") {
				if (value === "") {
					next.default = "";
				} else if (typeof value === "number") {
					next.default = Number.isFinite(value)
						? clampNumberOptional(value, bounds.min, bounds.max)
						: bounds.min;
				} else if (typeof value === "string") {
					next.default = value;
				}
			}

		if (typeof next.min === "number") {
			next.min = clampNumberOptional(next.min, bounds.min, bounds.max);
		}
		if (typeof next.max === "number") {
			next.max = clampNumberOptional(next.max, bounds.min, bounds.max);
		}
		if (typeof next.default === "number") {
			const minLimit = typeof next.min === "number" ? next.min : bounds.min;
			const maxLimit = typeof next.max === "number" ? next.max : bounds.max;
			const low = maxLimit === undefined ? minLimit : Math.min(minLimit, maxLimit);
			const high = maxLimit === undefined ? undefined : Math.max(minLimit, maxLimit);

			if (field === "default") {
				next.default = clampNumberOptional(next.default, bounds.min, high);
			} else {
				next.default = clampNumberOptional(next.default, low, high);
			}
		}

		return next;
	}

	const nextValue =
		typeof value === "number" ? (Number.isFinite(value) ? Math.max(0, value) : 0) : value;
	return { ...current, [field]: nextValue };
};

export const getModelParamDefaultOnBlur = (
	paramName: string,
	current: ModelParameterConfig,
): number | undefined => {
	const bounds = getModelParamBounds(paramName);
	if (!bounds || typeof current.default !== "number") {
		return undefined;
	}
	const minLimit = typeof current.min === "number" ? current.min : bounds.min;
	const maxLimit = typeof current.max === "number" ? current.max : bounds.max;
	const low = maxLimit === undefined ? minLimit : Math.min(minLimit, maxLimit);
	const high = maxLimit === undefined ? undefined : Math.max(minLimit, maxLimit);
	return clampNumberOptional(current.default, low, high);
};

export const getModelConfigValidationState = (
	parametersConfig: Record<string, ModelParameterConfig>,
) => {
	const isEmptyNumber = (value: number | string | undefined) =>
		value === "" || value === undefined;
	const numericParams = new Set(Object.keys(modelParamNumericBounds));
	const hasEmptyField = Object.entries(parametersConfig).some(([paramName, config]) => {
		if (!config.enabled || config.allowed || !numericParams.has(paramName)) {
			return false;
		}
		return (
			isEmptyNumber(config.min) || isEmptyNumber(config.max) || isEmptyNumber(config.default)
		);
	});

	const responseFormatConfig = parametersConfig.response_format;
	const hasEmptyResponseFormat = Boolean(
		responseFormatConfig?.enabled &&
			(!Array.isArray(responseFormatConfig.allowed) ||
				responseFormatConfig.allowed.length === 0),
	);
	const maxTokensConfig = parametersConfig.max_tokens;
	const hasInvalidTokenRange = Boolean(
		maxTokensConfig?.enabled &&
			typeof maxTokensConfig.min === "number" &&
			typeof maxTokensConfig.max === "number" &&
			maxTokensConfig.min > maxTokensConfig.max,
	);
	const temperatureConfig = parametersConfig.temperature;
	const hasInvalidTemperatureRange = Boolean(
		temperatureConfig?.enabled &&
			typeof temperatureConfig.min === "number" &&
			typeof temperatureConfig.max === "number" &&
			temperatureConfig.min > temperatureConfig.max,
	);

	return {
		hasEmptyField,
		hasEmptyResponseFormat,
		hasInvalidTokenRange,
		hasInvalidTemperatureRange,
	};
};

export const isValidBaseUrl = (value: string) => /^https?:\/\//i.test(value.trim());
