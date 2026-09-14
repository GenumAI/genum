import { useCallback, useEffect, useRef } from "react";
import usePlaygroundStore, { type TrajectoryDraft } from "@/stores/playground.store";

/**
 * Scoped access to the trajectory being authored for the current prompt/testcase --
 * mirrors `usePlaygroundOutput`'s shape for the same reason: switching prompts must not
 * leak one prompt's in-progress tool calls into another's.
 */
export function usePlaygroundTrajectory({
	promptId,
	testcaseId,
}: {
	promptId: number | undefined;
	testcaseId: string | null;
}) {
	const trajectory = usePlaygroundStore((state) =>
		state.getTrajectoryDraft(promptId, testcaseId),
	);

	/**
	 * Bumped every time the trajectory this hook points at is discarded or swapped out.
	 * A continuation turn is a network round trip; without this, a response that lands
	 * after the author pressed "Run" (or switched testcase) would append its steps onto
	 * the freshly emptied trajectory, resurrecting a stale turn into a new recording --
	 * wrong data in the exact structure this feature freezes into a testcase.
	 */
	const generationRef = useRef(0);

	const setTrajectory = useCallback(
		(updater: (prev: TrajectoryDraft) => TrajectoryDraft) => {
			usePlaygroundStore.getState().setTrajectoryDraft(promptId, testcaseId, updater);
		},
		[promptId, testcaseId],
	);

	const clearTrajectory = useCallback(() => {
		generationRef.current += 1;
		usePlaygroundStore.getState().clearTrajectoryDraft(promptId, testcaseId);
	}, [promptId, testcaseId]);

	// Scoping alone would send a late response to the right store key, but the author is
	// looking at a different prompt: the turn is no longer theirs to finish.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the scope IS the dependency
	useEffect(() => {
		generationRef.current += 1;
	}, [promptId, testcaseId]);

	return { trajectory, setTrajectory, clearTrajectory, trajectoryGeneration: generationRef };
}
