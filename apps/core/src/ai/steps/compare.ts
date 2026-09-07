import type { Step, StepsConfig, ToolCallStep } from "./types";

export type StepMismatch = {
	/** Index in the expected array, so the UI can point at the step the author picked. */
	index: number;
	reason: string;
};

/**
 * Order-independent deep equality for objects, order-sensitive for arrays.
 * Objects with different key orders are equal; arrays with different element
 * orders are not equal.
 */
function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) {
		return true;
	}
	if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
		return false;
	}
	if (Array.isArray(a) !== Array.isArray(b)) {
		return false;
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
	}
	const left = a as Record<string, unknown>;
	const right = b as Record<string, unknown>;
	const leftKeys = Object.keys(left);
	if (leftKeys.length !== Object.keys(right).length) {
		return false;
	}
	return leftKeys.every(
		(key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]),
	);
}

function argsMatchFor(step: ToolCallStep) {
	return step.argsMatch ?? "exact";
}

function argsAgree(expected: ToolCallStep, actual: ToolCallStep): boolean {
	const mode = argsMatchFor(expected);
	if (mode === "ignore") {
		return true;
	}

	const expectedArgs = expected.args ?? {};
	const actualArgs = actual.args ?? {};

	if (mode === "subset") {
		return Object.keys(expectedArgs).every(
			(key) => Object.hasOwn(actualArgs, key) && deepEqual(actualArgs[key], expectedArgs[key]),
		);
	}

	return deepEqual(actualArgs, expectedArgs);
}

function describe(step: Step): string {
	return step.kind === "tool_call" ? `tool "${step.name}"` : "the final answer";
}

function stepMatches(
	expected: Step,
	actual: Step,
): boolean {
	if (expected.kind !== actual.kind) {
		return false;
	}
	if (expected.kind === "final" && actual.kind === "final") {
		return expected.text === actual.text;
	}
	if (expected.kind === "tool_call" && actual.kind === "tool_call") {
		return expected.name === actual.name && argsAgree(expected, actual);
	}
	return false;
}

/**
 * Attempt to match enabled expected steps against actual steps with backtracking.
 * Returns a set of consumed actual indices if successful, or undefined if no valid
 * assignment exists. Only called for unordered matching (orderMatters: false).
 */
function tryMatchUnordered(
	expected: Step[],
	actual: Step[],
	enabledIndices: number[],
	consumed: Set<number> = new Set(),
	depth: number = 0,
): Set<number> | undefined {
	// Base case: all enabled expected steps have been matched
	if (depth === enabledIndices.length) {
		return consumed;
	}

	const expectedIdx = enabledIndices[depth];
	const expectedStep = expected[expectedIdx];

	// Try to match against each unconsumed actual step
	for (let i = 0; i < actual.length; i++) {
		if (consumed.has(i)) {
			continue;
		}
		const actualStep = actual[i];
		if (stepMatches(expectedStep, actualStep)) {
			// Try this assignment and recurse
			consumed.add(i);
			const result = tryMatchUnordered(expected, actual, enabledIndices, consumed, depth + 1);
			if (result !== undefined) {
				return result;
			}
			// Backtrack
			consumed.delete(i);
		}
	}

	return undefined;
}

/**
 * Compares only the steps the author enabled. Order is compared when
 * `config.orderMatters`; otherwise each expected step is matched against any not yet
 * consumed actual step, so a reordered but equivalent trajectory passes.
 *
 * When orderMatters is true, disabled steps do not consume positions in actual.
 * When orderMatters is false, uses backtracking to find a valid matching if the
 * number of enabled expected steps is <= 12; falls back to greedy for larger inputs.
 */
export function compareSteps(
	expected: Step[],
	actual: Step[],
	config: StepsConfig,
): StepMismatch[] {
	if (config.orderMatters) {
		return compareStepsOrdered(expected, actual);
	}
	return compareStepsUnordered(expected, actual);
}

function compareStepsOrdered(expected: Step[], actual: Step[]): StepMismatch[] {
	const mismatches: StepMismatch[] = [];
	let actualCursor = 0;

	expected.forEach((step, index) => {
		if (step.enabled === false) {
			return;
		}

		// Find the first actual step at or after the cursor that matches
		let found = false;
		for (let i = actualCursor; i < actual.length; i++) {
			const other = actual[i];
			if (stepMatches(step, other)) {
				actualCursor = i + 1;
				found = true;
				break;
			}
		}

		if (!found) {
			const called =
				step.kind === "tool_call" &&
				actual.some((other) => other.kind === "tool_call" && other.name === step.name);
			mismatches.push({
				index,
				reason: called
					? `${describe(step)} was called with different arguments`
					: `${describe(step)} was never called`,
			});
		}
	});

	return mismatches;
}

function compareStepsUnordered(expected: Step[], actual: Step[]): StepMismatch[] {
	const enabledIndices = expected
		.map((step, index) => (step.enabled === false ? -1 : index))
		.filter((index) => index !== -1);

	// Use backtracking only if the number of enabled steps is reasonable
	let consumed: Set<number> | undefined;
	if (enabledIndices.length <= 12) {
		consumed = tryMatchUnordered(expected, actual, enabledIndices);
	} else {
		// Fall back to greedy matching for large inputs
		consumed = greedyMatchUnordered(expected, actual, enabledIndices);
	}

	if (consumed === undefined) {
		consumed = new Set();
	}

	// Identify which expected steps were not matched
	const mismatches: StepMismatch[] = [];
	enabledIndices.forEach((index) => {
		const step = expected[index];
		const found = Array.from(consumed!).some((actualIndex) => {
			const other = actual[actualIndex];
			return stepMatches(step, other);
		});

		if (!found) {
			const called =
				step.kind === "tool_call" &&
				actual.some((other) => other.kind === "tool_call" && other.name === step.name);
			mismatches.push({
				index,
				reason: called
					? `${describe(step)} was called with different arguments`
					: `${describe(step)} was never called`,
			});
		}
	});

	return mismatches;
}

/**
 * Greedy matching fallback for >12 enabled expected steps to avoid pathological backtracking cost.
 */
function greedyMatchUnordered(
	expected: Step[],
	actual: Step[],
	enabledIndices: number[],
): Set<number> | undefined {
	const consumed = new Set<number>();

	for (const index of enabledIndices) {
		const step = expected[index];
		const found = actual.findIndex((actualStep, actualIndex) => {
			if (consumed.has(actualIndex)) {
				return false;
			}
			return stepMatches(step, actualStep);
		});

		if (found !== -1) {
			consumed.add(found);
		}
	}

	return consumed;
}
