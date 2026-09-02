import type { PlaceholderDefinition } from "./types";

/**
 * A stored selection (e.g. the playground store's flat, unscoped
 * `Record<key, valueName>`, which persists across prompts and is never invalidated
 * when a definition's values change) can hold a stale name — carried over from
 * another prompt, or a value since renamed or removed. That must not be treated as a
 * real selection, so both the UI that displays it and the caller that submits it need
 * to agree on the same filter.
 *
 * `definitions === null` means the definitions are not yet known — the query that
 * would supply them is loading, or it errored. That is NOT the same state as "known
 * to be empty": filtering against an empty array would silently drop every selection
 * on the one path that decides what the model receives, with no `ignored` echo either
 * (nothing was sent for the server to report on). So an unknown state passes the
 * selection through unfiltered instead, leaving the server's own `ignored` report —
 * which exists exactly for this — to do its job.
 */
export function filterValidPlaceholderSelections(
	selection: Record<string, string>,
	definitions: PlaceholderDefinition[] | null,
): Record<string, string> {
	if (definitions === null) {
		return { ...selection };
	}

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
