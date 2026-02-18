// Define types for model and model configuration
export interface Model {
	id: number;
	name: string;
	displayName?: string;
	vendor: string;
	promptPrice: number;
	completionPrice: number;
	contextTokensMax: number;
	completionTokensMax: number;
	description: string;
	createdAt: string;
	updatedAt: string;
	/** True when the model is disabled for the current organization but still assigned to this prompt. */
	isDisabled?: boolean;
}

interface ModelParameter {
	min?: number;
	max?: number;
	default: number | string;
	allowed?: string[];
}

export interface ResponseModelConfig {
	name: string;
	vendor: string;
	parameters: {
		response_format?: ModelParameter;
		temperature?: ModelParameter;
		top_p?: ModelParameter;
		max_tokens?: ModelParameter;
		frequency_penalty?: ModelParameter;
		presence_penalty?: ModelParameter;
		[key: string]: ModelParameter | undefined;
	};
}
