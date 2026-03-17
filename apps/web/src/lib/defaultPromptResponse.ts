import type { PromptResponse } from "@/api/prompt";

export const defaultPromptResponse: PromptResponse = {
	answer: "",
	tokens: {
		prompt: 0,
		completion: 0,
		total: 0,
	},
	cost: {
		prompt: 0,
		completion: 0,
		total: 0,
	},
	response_time_ms: 0,
	status: "",
};
