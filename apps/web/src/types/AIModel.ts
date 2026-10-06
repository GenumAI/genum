// Define types for model and model configuration
export interface Model {
	id: number;
	name: string;
	displayName?: string;
	vendor: string;
	promptPrice: number;
	completionPrice: number;
	/** USD per 1M cached input tokens, from the model registry. `null` where the vendor lists none. */
	cacheReadPrice?: number | null;
	contextTokensMax: number;
	completionTokensMax: number;
	description: string;
	createdAt: string;
	updatedAt: string;
	/** True when the model is disabled for the current organization but still assigned to this prompt. */
	isDisabled?: boolean;
	/** The vendor's withdrawal of the model, from the registry. `null` while it is current. */
	lifecycle?: ModelLifecycle | null;
}

/**
 * `deprecated` still runs until the vendor shuts it down; `retired` no longer runs at all. The
 * replacement is a suggestion only, never applied on the user's behalf.
 */
export type ModelLifecycle = (
	| { status: "deprecated"; retiresOn: string }
	| { status: "retired"; retiredOn: string }
) & { replacement?: string; replacementDisplayName?: string };

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
