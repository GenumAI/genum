import { useCallback } from "react";
import useAssertionStore from "@/stores/assertion.store";

type AssertionDraft = {
	value: string;
};

export function usePlaygroundAssertion({
	promptId,
	serverAssertionType,
	serverAssertionValue,
}: {
	promptId: number | undefined;
	serverAssertionType?: string;
	serverAssertionValue?: string;
}) {
	const assertionDraft = useAssertionStore((state) => state.getAssertionDraft(promptId));
	const currentAssertionType = serverAssertionType ?? "AI";
	const assertionValue = assertionDraft?.value ?? serverAssertionValue ?? "";

	const setAssertionValue = useCallback(
		(value: string) => {
			useAssertionStore.getState().setAssertionDraft(promptId, {
				value,
			} satisfies AssertionDraft);
		},
		[promptId],
	);

	const clearAssertionDraft = useCallback(() => {
		useAssertionStore.getState().clearAssertionDraft(promptId);
	}, [promptId]);

	return {
		currentAssertionType,
		assertionValue,
		setAssertionValue,
		clearAssertionDraft,
	};
}
