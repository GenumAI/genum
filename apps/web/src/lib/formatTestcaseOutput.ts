import type { PromptResponse } from "@/hooks/useRunPrompt";
import { defaultPromptResponse } from "@/stores/playground.store";

export function formatTestcaseOutput(output: any): PromptResponse {
	if (!output) {
		return defaultPromptResponse;
	}

	if (typeof output === "object" && "answer" in output) {
		const result = {
			...output,
			answer: output.answer ?? "",
		};
		return result;
	}

	if (typeof output === "string") {
		return {
			answer: output,
			tokens: defaultPromptResponse.tokens,
			cost: defaultPromptResponse.cost,
			response_time_ms: defaultPromptResponse.response_time_ms,
			status: defaultPromptResponse.status,
		};
	}

	if (typeof output === "object") {
		return {
			answer: output.toString() || "",
			tokens: output.tokens || defaultPromptResponse.tokens,
			cost: output.cost || defaultPromptResponse.cost,
			response_time_ms: output.response_time_ms || defaultPromptResponse.response_time_ms,
			status: output.status || defaultPromptResponse.status,
		};
	}

	return defaultPromptResponse;
}


