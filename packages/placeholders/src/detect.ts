/**
 * The one definition of the placeholder syntax. Everything that reads or writes a
 * `{{key}}` — the runtime, the playground chips, the Placeholders tab — goes through
 * this module, so the UI cannot promise a substitution the runtime will not perform.
 *
 * The `g` flag makes the regex stateful, so callers must never share this instance:
 * `detectPlaceholderKeys` and `renderPlaceholders` each build their own from `.source`.
 */
export const PLACEHOLDER_KEY_PATTERN = /\{\{([a-zA-Z0-9_]+)\}\}/g;

export function detectPlaceholderKeys(text: string): string[] {
	const pattern = new RegExp(PLACEHOLDER_KEY_PATTERN.source, "g");
	const seen = new Set<string>();
	const keys: string[] = [];

	let match = pattern.exec(text);
	while (match !== null) {
		const key = match[1];
		if (!seen.has(key)) {
			seen.add(key);
			keys.push(key);
		}
		match = pattern.exec(text);
	}

	return keys;
}

/**
 * Rewrite every `{{oldKey}}` occurrence to `{{newKey}}`.
 *
 * Renaming a placeholder renames a definition; without this the prompt text keeps
 * pointing at a key that no longer exists, the hole renders verbatim, and the author
 * is told the placeholder is "not defined" for a placeholder they only renamed. The
 * rewrite goes through this module so it cannot drift from the syntax the runtime
 * substitutes -- a hand-rolled regex here is how the UI starts promising a
 * substitution the runtime will not perform.
 *
 * Returns the text unchanged (and `occurrences: 0`) when the key does not occur, so
 * callers can decide whether the rename touched the prompt at all.
 */
export function renamePlaceholderKey(
	text: string,
	oldKey: string,
	newKey: string,
): { text: string; occurrences: number } {
	if (oldKey === newKey) {
		return { text, occurrences: 0 };
	}

	let occurrences = 0;
	const pattern = new RegExp(PLACEHOLDER_KEY_PATTERN.source, "g");
	const next = text.replace(pattern, (match, key: string) => {
		if (key !== oldKey) return match;
		occurrences += 1;
		return `{{${newKey}}}`;
	});

	return { text: next, occurrences };
}
