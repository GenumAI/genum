import type { Step, StepsConfig, ToolCallStep } from "./types";

export type StepMismatch = {
	/** Index in the expected array, so the UI can point at the step the author picked. */
	index: number;
	reason: string;
};

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
			(key) => JSON.stringify(actualArgs[key]) === JSON.stringify(expectedArgs[key]),
		);
	}

	return JSON.stringify(actualArgs) === JSON.stringify(expectedArgs);
}

function describe(step: Step): string {
	return step.kind === "tool_call" ? `tool "${step.name}"` : "the final answer";
}

/**
 * Compares only the steps the author enabled. Order is compared when
 * `config.orderMatters`; otherwise each expected step is matched against any not yet
 * consumed actual step, so a reordered but equivalent trajectory passes.
 */
export function compareSteps(
	expected: Step[],
	actual: Step[],
	config: StepsConfig,
): StepMismatch[] {
	const mismatches: StepMismatch[] = [];
	const consumed = new Set<number>();

	expected.forEach((step, index) => {
		if (step.enabled === false) {
			return;
		}

		const candidates = config.orderMatters ? [index] : actual.map((_, i) => i);

		const found = candidates.find((candidate) => {
			if (consumed.has(candidate)) {
				return false;
			}
			const other = actual[candidate];
			if (!other || other.kind !== step.kind) {
				return false;
			}
			if (step.kind === "final" && other.kind === "final") {
				return step.text === other.text;
			}
			if (step.kind === "tool_call" && other.kind === "tool_call") {
				return step.name === other.name && argsAgree(step, other);
			}
			return false;
		});

		if (found === undefined) {
			const called =
				step.kind === "tool_call" &&
				actual.some((other) => other.kind === "tool_call" && other.name === step.name);
			mismatches.push({
				index,
				reason: called
					? `${describe(step)} was called with different arguments`
					: `${describe(step)} was never called`,
			});
			return;
		}

		consumed.add(found);
	});

	return mismatches;
}
