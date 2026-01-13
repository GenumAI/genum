// diff between two str values. for git commit generator

import type { ModelConfigParameters } from "@/ai/models/types";
import { objToXml } from "@/utils/xml";

interface LineDiff {
	added: string[];
	removed: string[];
}

export type PromptState = {
	value: string;
	languageModelConfig: ModelConfigParameters;
	languageModelId: number;
};

export async function findDiff(
	oldState: PromptState,
	newState: PromptState,
	modelCallback: (modelId: number) => Promise<string>,
) {
	const promptDiff = findValueChanges(oldState.value, newState.value);
	const languageModelConfigDiff = findValueChanges(
		JSON.stringify(oldState.languageModelConfig, null, 2),
		JSON.stringify(newState.languageModelConfig, null, 2),
	);

	let languageModelIdDiff = "";
	if (oldState.languageModelId !== newState.languageModelId) {
		const modelName = await modelCallback(newState.languageModelId);
		languageModelIdDiff += `\nModel changed to ${modelName}`;
	}

	const result = objToXml({
		promptChanges: promptDiff,
		languageModelConfigChanges: languageModelConfigDiff,
		languageModelChanges: languageModelIdDiff,
	});

	return result;
}

function diffLines(oldText: string, newText: string): LineDiff {
	const oldLines = oldText.split("\n");
	const newLines = newText.split("\n");

	const added = newLines.filter((line) => !oldLines.includes(line));
	const removed = oldLines.filter((line) => !newLines.includes(line));

	return { added, removed };
}

function findValueChanges(oldText: string, newText: string): string {
	const diff = diffLines(oldText, newText);

	const addedLines = diff.added.map((line) => `+ ${line}`);
	const removedLines = diff.removed.map((line) => `- ${line}`);

	return [...addedLines, ...removedLines].join("\n");
}
