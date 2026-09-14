import { detectPlaceholderKeys } from "@genum/placeholders";

export type PlaceholderCoverage = {
	/** `{{key}}` appears in the text, but nothing defines it. It will render as itself. */
	undefinedKeys: string[];
	/** A definition whose key is nowhere in the text. Nothing will ever substitute it. */
	ignored: string[];
};

/**
 * How a prompt's text and its placeholder definitions line up.
 *
 * Neither half of a mismatch is an error -- a prompt with an unused definition or an
 * undefined hole is storable and runnable -- but both are almost always a typo, and both
 * are invisible afterwards: an undefined hole renders as the literal `{{key}}` inside the
 * instruction the model reads, and an unused definition simply never fires. Reported at
 * creation time they cost the caller one glance; discovered later they are a
 * model-quality complaint with no obvious cause.
 *
 * The names match `renderPlaceholders`' own report, which draws the same two distinctions
 * at run time, so a caller learns one vocabulary rather than two.
 */
export function placeholderCoverage(
	text: string,
	definitions: { key: string }[],
): PlaceholderCoverage {
	const keysInText = detectPlaceholderKeys(text);
	const defined = new Set(definitions.map((definition) => definition.key));
	const inText = new Set(keysInText);

	return {
		undefinedKeys: keysInText.filter((key) => !defined.has(key)),
		// Deduplicated against the definitions rather than trusted to be unique: this runs
		// on validated input today, but a duplicated key here would report the same
		// unused definition twice.
		ignored: [...defined].filter((key) => !inText.has(key)),
	};
}
