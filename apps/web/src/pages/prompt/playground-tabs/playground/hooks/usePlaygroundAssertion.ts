import { useCallback } from "react";
import usePlaygroundStore from "@/stores/playground.store";

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
	const assertionDraft = usePlaygroundStore((state) => state.getAssertionDraft(promptId));
	const currentAssertionType = assertionDraft?.type ?? serverAssertionType ?? "AI";
	const assertionValue = assertionDraft?.value ?? serverAssertionValue ?? "";

	const setAssertionType = useCallback(
		(value: string) => {
			const previous = usePlaygroundStore.getState().getAssertionDraft(promptId);
			usePlaygroundStore.getState().setAssertionDraft(promptId, {
				type: value,
				value: previous?.value ?? serverAssertionValue ?? "",
			} satisfies AssertionDraft);
		},
		[promptId, serverAssertionValue],
	);

	const setAssertionValue = useCallback(
		(value: string) => {
			const previous = usePlaygroundStore.getState().getAssertionDraft(promptId);
			usePlaygroundStore.getState().setAssertionDraft(promptId, {
				type: previous?.type ?? serverAssertionType ?? "AI",
				value,
			} satisfies AssertionDraft);
		},
		[promptId, serverAssertionType],
	);

	const clearAssertionDraft = useCallback(() => {
		usePlaygroundStore.getState().clearAssertionDraft(promptId);
	}, [promptId]);

	return {
		currentAssertionType,
		assertionValue,
		setAssertionType,
		setAssertionValue,
		clearAssertionDraft,
	};
}
