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
