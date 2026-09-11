/**
 * The comparison a STRICT assertion has always used, lifted out of
 * `controllers/testcase.controller.ts` so the steps layer can reuse it without
 * depending on a controller. Behaviour is unchanged and pinned by `normalize.test.ts`:
 * the text path is shipped and working, and a trajectory's final answer must not be
 * asserted more strictly than the text testcase it replaces.
 */

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortKeys);
	} else if (value !== null && typeof value === "object") {
		return Object.keys(value as Record<string, unknown>)
			.filter((key) => key !== "chainOfThoughts") // exclude chainOfThought
			.sort()
			.reduce((acc: Record<string, unknown>, key) => {
				acc[key] = sortKeys((value as Record<string, unknown>)[key]);
				return acc;
			}, {});
	}
	return value;
}

export function normalize(input: unknown): string {
	try {
		const parsed = JSON.parse(String(input));
		// convert object to standard view, sorting keys (without chainOfThought)
		return JSON.stringify(sortKeys(parsed));
	} catch {
		// if not JSON, simply convert string to one view
		return String(input).trim().toLowerCase();
	}
}
