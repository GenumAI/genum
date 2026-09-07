import { useCallback } from "react";
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

	const setTrajectory = useCallback(
		(updater: (prev: TrajectoryDraft) => TrajectoryDraft) => {
			usePlaygroundStore.getState().setTrajectoryDraft(promptId, testcaseId, updater);
		},
		[promptId, testcaseId],
	);

	const clearTrajectory = useCallback(() => {
		usePlaygroundStore.getState().clearTrajectoryDraft(promptId, testcaseId);
	}, [promptId, testcaseId]);

	return { trajectory, setTrajectory, clearTrajectory };
}
