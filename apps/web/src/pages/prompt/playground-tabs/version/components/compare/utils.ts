import { diffLines } from "diff";
import { parseJson } from "@/lib/jsonUtils";

export const AccordionKeys = {
	Prompt: "value",
	Model: "languageModel",
	Model_Config: "languageModelConfig",
	Json_Schema: "languageModelConfig.json_schema",
	Tools: "languageModelConfig.tools",
} as const;

export type AccordionKey = (typeof AccordionKeys)[keyof typeof AccordionKeys];

export function getByPath(obj: any, path: string): unknown {
	return path.split(".").reduce((acc: any, key: string) => {
		if (acc && typeof acc === "object") {
			return acc[key];
		}
		return undefined;
	}, obj);
}

export const getChangedLinesStats = (a: string, b: string) => {
	const left = typeof a === "string" ? a : "";
	const right = typeof b === "string" ? b : "";
	const diff = diffLines(left, right);
	let added = 0;
	let removed = 0;
	diff.forEach((part) => {
		if (part.added) added += part.count || 0;
		if (part.removed) removed += part.count || 0;
	});
	return { added, removed };
};

export const formatCompareValue = (key: string, value: any): string => {
	if (value === null || value === undefined) return "";

	let processedValue = value;

	if (key === "languageModel") {
		if (typeof value === "object") {
			processedValue = {
				name: value.name,
				vendor: value.vendor,
			};
		}
	}

	if (key === "languageModelConfig") {
		// In the original code, it was stripping nothing but assigning rest to a variable.
		// It seems it was intended to strip something.
		// Looking at lines 262-269 of Compare.tsx:
		// const stripJsonSchemaAndTools = (obj: any) => { if (!obj || typeof obj !== "object") return obj; const { ...rest } = obj; return rest; };
		// It didn't actually strip anything. I'll keep it as is for now but maybe it should strip json_schema and tools?
		// Actually, if we are showing them in separate accordions, maybe we should strip them here.
		if (typeof value === "object") {
			const { json_schema: _js, tools: _ts, ...rest } = value;
			processedValue = rest;
		}
	}

	if (key === "languageModelConfig.json_schema") {
		return typeof value === "string" ? parseJson(value) : JSON.stringify(value, null, 2);
	}

	return typeof processedValue === "string"
		? processedValue
		: JSON.stringify(processedValue, null, 2);
};
