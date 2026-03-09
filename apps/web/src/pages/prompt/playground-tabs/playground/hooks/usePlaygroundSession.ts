import { useCallback } from "react";
import usePlaygroundStore from "@/stores/playground.store";

type PlaygroundSessionState = {
	runLoading: boolean;
	wasRun: boolean;
	isTestcaseLoaded: boolean;
	status: string;
};

const defaultSessionState: PlaygroundSessionState = {
	runLoading: false,
	wasRun: false,
	isTestcaseLoaded: false,
	status: "",
};

export function usePlaygroundSession({
	promptId,
	testcaseId,
}: {
	promptId: number | undefined;
	testcaseId: string | null;
}) {
	const session = usePlaygroundStore((state) => state.getSessionDraft(promptId, testcaseId));

	const setSession = useCallback(
		(updater: (prev: PlaygroundSessionState) => PlaygroundSessionState) => {
			usePlaygroundStore.getState().setSessionDraft(promptId, testcaseId, (prev) =>
				updater(prev ?? defaultSessionState),
			);
		},
		[promptId, testcaseId],
	);

	const setRunState = useCallback(
		(state: { loading: boolean; wasRun?: boolean }) => {
			setSession((prev) => ({
				...prev,
				runLoading: state.loading,
				...(state.wasRun !== undefined ? { wasRun: state.wasRun } : {}),
			}));
		},
		[setSession],
	);

	const setTestcaseLoadState = useCallback(
		(state: { loaded: boolean; status?: string }) => {
			setSession((prev) => ({
				...prev,
				isTestcaseLoaded: state.loaded,
				...(state.status !== undefined ? { status: state.status } : {}),
			}));
		},
		[setSession],
	);

	const setStatus = useCallback(
		(status: string) => {
			setSession((prev) => ({ ...prev, status }));
		},
		[setSession],
	);

	return {
		runLoading: session.runLoading,
		wasRun: session.wasRun,
		isTestcaseLoaded: session.isTestcaseLoaded,
		status: session.status,
		setRunState,
		setTestcaseLoadState,
		setStatus,
	};
}
