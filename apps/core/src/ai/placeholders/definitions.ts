import type { Placeholder, PlaceholderValue } from "@/prisma";
import type { PlaceholderDefinition } from "@genum/placeholders";

type PlaceholderRow = Placeholder & { values: PlaceholderValue[] };

export function toPlaceholderDefinitions(rows: PlaceholderRow[]): PlaceholderDefinition[] {
	return rows.map((row) => ({
		key: row.key,
		values: row.values.map((value) => ({
			name: value.name,
			content: value.content,
			isDefault: value.isDefault,
		})),
	}));
}

/**
 * `PromptVersion.placeholders` is Json, so it can hold anything a past or future
 * version of this code wrote. A malformed snapshot must degrade to "no definitions"
 * — which renders every hole as itself — rather than throw inside a paid run.
 */
export function parsePlaceholderSnapshot(value: unknown): PlaceholderDefinition[] {
	if (!Array.isArray(value)) return [];

	const definitions: PlaceholderDefinition[] = [];
	for (const entry of value) {
		if (typeof entry !== "object" || entry === null) return [];
		const candidate = entry as Record<string, unknown>;
		if (typeof candidate.key !== "string" || !Array.isArray(candidate.values)) return [];

		const values = [];
		for (const raw of candidate.values) {
			if (typeof raw !== "object" || raw === null) return [];
			const v = raw as Record<string, unknown>;
			if (
				typeof v.name !== "string" ||
				typeof v.content !== "string" ||
				typeof v.isDefault !== "boolean"
			) {
				return [];
			}
			values.push({ name: v.name, content: v.content, isDefault: v.isDefault });
		}

		definitions.push({ key: candidate.key, values });
	}

	return definitions;
}

/**
 * A canonical, order-independent fingerprint of a prompt's placeholder definitions,
 * for `commitHash`.
 *
 * Placeholders carry logic that is committed with the prompt, so editing one must make
 * the prompt uncommitted the way editing its text does. Without this, a key could be
 * renamed or a value's content rewritten while the prompt still reads "committed" and
 * production keeps serving the old snapshot.
 *
 * Sorted by key, then by value name, so a delete-and-recreate that changes only row ids
 * does not read as a change. `isDefault` and `content` are in, because both change what
 * the model receives. Returns `null` for "no placeholders" so `commitHash` can leave the
 * hashed object byte-identical for every prompt that has none -- otherwise adding this
 * field would flag every existing prompt in the fleet as uncommitted at once.
 */
export function placeholderFingerprint(definitions: PlaceholderDefinition[]): string | null {
	if (definitions.length === 0) return null;

	const canonical = [...definitions]
		.sort((a, b) => a.key.localeCompare(b.key))
		.map((definition) => ({
			key: definition.key,
			values: [...definition.values]
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((value) => ({
					name: value.name,
					content: value.content,
					isDefault: value.isDefault,
				})),
		}));

	return JSON.stringify(canonical);
}
