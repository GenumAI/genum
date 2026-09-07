import { normalize } from "@/utils/normalize";
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
	return leftKeys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]));
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
			(key) =>
				Object.hasOwn(actualArgs, key) && deepEqual(actualArgs[key], expectedArgs[key]),
		);
	}

	return deepEqual(actualArgs, expectedArgs);
}

function describe(step: Step): string {
	return step.kind === "tool_call" ? `tool "${step.name}"` : "the final answer";
}

function stepMatches(expected: Step, actual: Step): boolean {
	if (expected.kind !== actual.kind) {
		return false;
	}
	if (expected.kind === "final" && actual.kind === "final") {
		// The same `normalize` a STRICT text assertion uses (see utils/normalize.ts).
		// Converting a text testcase into a trajectory one must not silently make the
		// answer assertion stricter -- trailing whitespace or capitalisation going red
		// only teaches authors to untick the final answer.
		return normalize(expected.text) === normalize(actual.text);
	}
	if (expected.kind === "tool_call" && actual.kind === "tool_call") {
		return expected.name === actual.name && argsAgree(expected, actual);
	}
	return false;
}

/**
 * Maximum bipartite matching (Kuhn's algorithm) between the enabled expected steps and
 * the actual ones. Returns the assignment as expectedIndex -> actualIndex.
 *
 * The assignment is the answer, not a by-product: mismatches are the expected indices
 * MISSING from it. Re-deriving "this step was found" by testing it against the set of
 * consumed actual steps is what let thirteen pinned calls pass against one actual call.
 *
 * Maximum matching also means the report is minimal -- only the steps that genuinely
 * cannot be satisfied are listed, instead of every enabled step whenever no complete
 * assignment exists -- and it is polynomial, so there is no input size at which we have
 * to fall back to a greedy pass that answers a different question.
 */
function matchUnordered(
	expected: Step[],
	actual: Step[],
	enabledIndices: number[],
): Map<number, number> {
	// actualIndex -> expectedIndex currently assigned to it
	const assignedTo = new Map<number, number>();

	const augment = (expectedIdx: number, visited: Set<number>): boolean => {
		for (let i = 0; i < actual.length; i++) {
			if (visited.has(i) || !stepMatches(expected[expectedIdx], actual[i])) {
				continue;
			}
			visited.add(i);
			const holder = assignedTo.get(i);
			// Free, or its current holder can be re-seated somewhere else.
			if (holder === undefined || augment(holder, visited)) {
				assignedTo.set(i, expectedIdx);
				return true;
			}
		}
		return false;
	};

	for (const expectedIdx of enabledIndices) {
		augment(expectedIdx, new Set());
	}

	const assignment = new Map<number, number>();
	for (const [actualIdx, expectedIdx] of assignedTo) {
		assignment.set(expectedIdx, actualIdx);
	}
	return assignment;
}

/**
 * Compares only the steps the author enabled. Order is compared when
 * `config.orderMatters`; otherwise each expected step is matched against any not yet
 * consumed actual step, so a reordered but equivalent trajectory passes.
 *
 * When orderMatters is true, disabled steps do not consume positions in actual.
 * When orderMatters is false, a maximum bipartite matching decides the assignment (see
 * `matchUnordered`) and the mismatches are exactly the expected steps it could not seat.
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

	const assignment = matchUnordered(expected, actual, enabledIndices);

	// A mismatch is an enabled expected step with no entry in the assignment.
	const mismatches: StepMismatch[] = [];
	enabledIndices.forEach((index) => {
		if (assignment.has(index)) {
			return;
		}
		const step = expected[index];
		const called =
			step.kind === "tool_call" &&
			actual.some((other) => other.kind === "tool_call" && other.name === step.name);
		mismatches.push({
			index,
			reason: called
				? `${describe(step)} was called with different arguments`
				: `${describe(step)} was never called`,
		});
	});

	return mismatches;
}
