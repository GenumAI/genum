import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { testcasesApi } from "@/api/testcases/testcases.api";
import { useToast } from "@/hooks/useToast";
import {
	enabledCount,
	hasStepComparison,
	mismatchByIndex,
	withStepPatch,
} from "@/lib/trajectoryEdits";
import { testcaseKeys } from "@/query-keys/testcases.keys";
import type { TestCase } from "@/types/TestСase";
import type { ArgsMatch, Step, StepsConfig } from "@/types/steps";

interface UseTestcaseTrajectoryParams {
	testcaseId?: string | number | null;
	testcase?: TestCase | null;
}

const NO_STEPS: Step[] = [];

export function useTestcaseTrajectory({ testcaseId, testcase }: UseTestcaseTrajectoryParams) {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	// A Json? column: a row written by hand, or before the boundary guard existed, can be
	// anything. Anything that is not an array is treated as "no trajectory" rather than
	// rendered.
	const steps = Array.isArray(testcase?.expectedSteps) ? testcase.expectedSteps : NO_STEPS;
	const hasTrajectory = steps.length > 0;

	const stepsConfig: StepsConfig = useMemo(
		() => ({ orderMatters: testcase?.stepsConfig?.orderMatters === true }),
		[testcase?.stepsConfig?.orderMatters],
	);

	const mismatches = useMemo(
		() => mismatchByIndex(testcase?.lastMismatches),
		[testcase?.lastMismatches],
	);

	// Whether the last run compared the pinned steps. The panel gates its per-step marks
	// on this and not on "has been run": a run that produced a verdict without comparing
	// (a tool the recording does not cover, an AI or MANUAL assertion) leaves every step
	// unmarked rather than green.
	const comparisonRecorded = useMemo(
		() => hasStepComparison(testcase?.lastMismatches),
		[testcase?.lastMismatches],
	);

	// `lastSteps` is written on every trajectory run, so a non-empty one means the testcase
	// has been run at all -- which is what the header line reports. `Boolean([])` is true,
	// so the length check is load-bearing.
	const hasRun = Array.isArray(testcase?.lastSteps) && testcase.lastSteps.length > 0;

	const { mutateAsync, isPending } = useMutation({
		mutationKey: testcaseKeys.updateTrajectory(testcaseId ?? undefined),
		mutationFn: async (update: {
			expectedSteps?: Step[] | null;
			stepsConfig?: StepsConfig | null;
		}) => {
			if (!testcaseId) return;
			return testcasesApi.updateTestcase(testcaseId, update);
		},
		onSuccess: (data) => {
			const updated = data?.testcase;
			if (!updated || !testcaseId) return;

			queryClient.setQueryData(testcaseKeys.byId(testcaseId), { testcase: updated });
			if (testcase?.promptId) {
				queryClient.setQueryData(
					testcaseKeys.promptTestcases(testcase.promptId),
					(prev: TestCase[] | undefined) =>
						prev?.map((tc) => (tc.id === updated.id ? updated : tc)) ?? prev,
				);
			}
		},
		onError: (error: unknown) => {
			// The control re-renders from the cache, which still holds the persisted
			// value, so a rejected write leaves the checkbox showing what is actually
			// stored rather than what the author clicked.
			toast({
				title: "Could not save",
				description: error instanceof Error ? error.message : "Unknown error",
				variant: "destructive",
			});
		},
	});

	/**
	 * The boundary rejects an expectedSteps with nothing enabled -- a testcase that
	 * asserts nothing always passes. Rather than send a request we know will 400, the
	 * panel offers to remove the trajectory instead.
	 */
	const wouldEmptyTrajectory = useCallback(
		(index: number) => enabledCount(withStepPatch(steps, index, { enabled: false })) === 0,
		[steps],
	);

	const setStepEnabled = useCallback(
		async (index: number, enabled: boolean) => {
			if (!enabled && wouldEmptyTrajectory(index)) return;
			await mutateAsync({ expectedSteps: withStepPatch(steps, index, { enabled }) });
		},
		[mutateAsync, steps, wouldEmptyTrajectory],
	);

	const setStepArgsMatch = useCallback(
		async (index: number, argsMatch: ArgsMatch) => {
			await mutateAsync({ expectedSteps: withStepPatch(steps, index, { argsMatch }) });
		},
		[mutateAsync, steps],
	);

	const setOrderMatters = useCallback(
		async (orderMatters: boolean) => {
			await mutateAsync({ stepsConfig: { orderMatters } });
		},
		[mutateAsync],
	);

	/**
	 * Sending `null` clears the column. The server cascades stepsConfig and
	 * lastMismatches, so the testcase is left as the plain text one underneath -- whose
	 * expectedOutput has been kept in step with the final step all along.
	 */
	const removeTrajectory = useCallback(async () => {
		await mutateAsync({ expectedSteps: null });
	}, [mutateAsync]);

	return {
		steps,
		stepsConfig,
		mismatchByIndex: mismatches,
		comparisonRecorded,
		hasRun,
		// The column a run writes, not `updatedAt` -- which every expectation edit bumps,
		// and so would date a stale verdict to the moment its rules changed.
		lastRunAt: testcase?.lastRunAt ?? null,
		hasTrajectory,
		saving: isPending,
		wouldEmptyTrajectory,
		setStepEnabled,
		setStepArgsMatch,
		setOrderMatters,
		removeTrajectory,
	};
}
