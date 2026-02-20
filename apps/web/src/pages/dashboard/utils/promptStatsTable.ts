import type { PromptName } from "@/types/logs";

export function getPromptDisplayName(promptId: number, promptNames: PromptName[]): string {
	return promptNames.find((prompt) => prompt.id === promptId)?.name || `Prompt ${promptId}`;
}

export function isPromptDeleted(promptId: number, promptNames: PromptName[]): boolean {
	return !promptNames.some((prompt) => prompt.id === promptId);
}

export function buildPromptLogsPath(
	orgId: string | undefined,
	projectId: string | undefined,
	promptId: number,
): string | null {
	if (!orgId || !projectId) return null;
	return `/${orgId}/${projectId}/prompt/${promptId}/logs`;
}

export function formatPromptCost(value: number): string {
	return `$${value.toFixed(4)}`;
}

export function formatModelCost(value: number): string {
	return `$ ${value.toFixed(4)}`;
}

export function formatPromptErrorRate(value: number): string {
	return `${value.toFixed(2)}%`;
}

export function formatPromptLastUsed(value: string): string {
	return new Date(value).toLocaleString();
}

export function formatUserCost(value: number): string {
	return `$${value.toFixed(2)}`;
}

export function formatUserActivityDate(value: string): string {
	return new Date(value).toLocaleDateString();
}
