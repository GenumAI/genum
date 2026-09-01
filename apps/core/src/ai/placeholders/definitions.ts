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
