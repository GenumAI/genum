import type { Prompt } from "./types";

export const getPromptTestcasesCount = (prompt?: Prompt) =>
	(prompt?.testcaseStatuses?.OK || 0) +
	(prompt?.testcaseStatuses?.NOK || 0) +
	(prompt?.testcaseStatuses?.NEED_RUN || 0);

export const getNewPromptName = (prompts: Prompt[]) => {
	const newPromptCount = prompts.filter((prompt) => prompt.name.startsWith("New Prompt")).length + 1;
	return `New Prompt ${newPromptCount}`;
};
