import type { PromptPlaceholder } from "@/api/prompt/placeholder.api";

/**
 * The playground store's selection map is a flat, unscoped Record<key, valueName>
 * that persists across prompts and is never invalidated when a definition's values
 * change. A stale name — carried over from another prompt, or a value since
 * renamed/removed — must not be treated as a real selection: PlaceholderChips uses
 * this to decide what the popover's checkmark shows, and usePlaygroundPromptRun uses
 * it to filter what actually gets sent, so the two always agree with each other.
 */
export function filterValidPlaceholderSelections(
	selection: Record<string, string>,
	definitions: PromptPlaceholder[],
): Record<string, string> {
	const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));
	const filtered: Record<string, string> = {};

	for (const [key, valueName] of Object.entries(selection)) {
		const definition = definitionsByKey.get(key);
		if (definition?.values.some((value) => value.name === valueName)) {
			filtered[key] = valueName;
		}
	}

	return filtered;
}
