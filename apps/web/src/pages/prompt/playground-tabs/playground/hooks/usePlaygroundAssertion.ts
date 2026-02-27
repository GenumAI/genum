import { useCallback } from "react";
import useAssertionStore from "@/stores/assertion.store";

type AssertionDraft = {
	type: string;
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
	const currentAssertionType = assertionDraft?.type ?? serverAssertionType ?? "AI";
	const assertionValue = assertionDraft?.value ?? serverAssertionValue ?? "";

	const setAssertionType = useCallback(
		(value: string) => {
			const previous = useAssertionStore.getState().getAssertionDraft(promptId);
			useAssertionStore.getState().setAssertionDraft(promptId, {
				type: value,
				value: previous?.value ?? serverAssertionValue ?? "",
			} satisfies AssertionDraft);
		},
		[promptId, serverAssertionValue],
	);

	const setAssertionValue = useCallback(
		(value: string) => {
			const previous = useAssertionStore.getState().getAssertionDraft(promptId);
			useAssertionStore.getState().setAssertionDraft(promptId, {
				type: previous?.type ?? serverAssertionType ?? "AI",
				value,
			} satisfies AssertionDraft);
		},
		[promptId, serverAssertionType],
	);

	const clearAssertionDraft = useCallback(() => {
		useAssertionStore.getState().clearAssertionDraft(promptId);
	}, [promptId]);

	return {
		currentAssertionType,
		assertionValue,
		setAssertionType,
		setAssertionValue,
		clearAssertionDraft,
	};
}
