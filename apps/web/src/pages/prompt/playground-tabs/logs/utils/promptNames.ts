import type { PromptName } from "@/types/logs";

export function getPromptName(promptId: number | undefined, promptNames: PromptName[]) {
	if (!promptId) {
		return "-";
	}

	return promptNames.find((prompt) => prompt.id === promptId)?.name || `Prompt ${promptId}`;
}

export function isPromptDeleted(promptId: number | undefined, promptNames: PromptName[]) {
	if (!promptId) {
		return false;
	}

	return !promptNames.find((prompt) => prompt.id === promptId);
}
