import { detectPlaceholderKeys, PLACEHOLDER_KEY_PATTERN } from "./detect";
import type { PlaceholderDefinition, PlaceholderSelection, RenderResult } from "./types";

export function renderPlaceholders(
	text: string,
	definitions: PlaceholderDefinition[],
	selection: PlaceholderSelection,
): RenderResult {
	const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
	const keysInText = detectPlaceholderKeys(text);
	const keysInTextSet = new Set(keysInText);

	const resolved: Record<string, string | null> = {};
	const ignored: string[] = [];
	const undefinedKeys: string[] = [];
	const content = new Map<string, string>();

	for (const key of keysInText) {
		const definition = byKey.get(key);
		if (!definition) {
			undefinedKeys.push(key);
			continue;
		}

		const requested = selection[key];
		const chosen =
			requested === undefined
				? undefined
				: definition.values.find((value) => value.name === requested);

		// A name that does not exist is caller error, not a request for the default.
		// It still falls back, so the run works, but it is reported rather than hidden.
		if (requested !== undefined && !chosen) {
			ignored.push(key);
		}

		const effective = chosen ?? definition.values.find((value) => value.isDefault);
		resolved[key] = effective ? effective.name : null;
		content.set(key, effective ? effective.content : "");
	}

	// A selection for a key that is not a hole in this text is dropped — decision 5 in
	// the spec — and reported, because silently discarding it turns a caller's typo
	// into a model-quality complaint.
	for (const key of Object.keys(selection)) {
		if (!keysInTextSet.has(key) && !ignored.includes(key)) {
			ignored.push(key);
		}
	}

	const pattern = new RegExp(PLACEHOLDER_KEY_PATTERN.source, "g");
	const rendered = text.replace(pattern, (match, key: string) =>
		content.has(key) ? (content.get(key) as string) : match,
	);

	return { text: rendered, resolved, ignored, undefinedKeys };
}
