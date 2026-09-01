import type { PlaceholderSelection } from "@genum/placeholders";

export const LEGACY_MEMORY_PLACEHOLDER_KEY = "memory_key";

/**
 * The only place the deprecated `memoryKey` field survives. `RunPromptSchema` is
 * `.strict()`, so removing the field would answer an existing integrator with a 400
 * rather than a degradation — but everything downstream sees one shape.
 */
export function mergePlaceholderInput(input: {
	placeholders?: PlaceholderSelection;
	memoryKey?: string;
}): PlaceholderSelection {
	const selection: PlaceholderSelection = { ...(input.placeholders ?? {}) };

	if (input.memoryKey && selection[LEGACY_MEMORY_PLACEHOLDER_KEY] === undefined) {
		selection[LEGACY_MEMORY_PLACEHOLDER_KEY] = input.memoryKey;
	}

	return selection;
}
