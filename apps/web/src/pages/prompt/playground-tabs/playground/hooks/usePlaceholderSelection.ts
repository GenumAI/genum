import { useEffect } from "react";
import { filterValidPlaceholderSelections } from "@genum/placeholders";
import usePlaygroundStore from "@/stores/playground.store";
import { usePromptPlaceholders } from "@/pages/prompt/playground-tabs/placeholders/hooks/usePromptPlaceholders";

/**
 * The single reading of "what the author currently has selected".
 *
 * `selectedPlaceholders` is keyed by placeholder KEY, and nothing used to prune it: rename
 * a placeholder and the old key sat in the store forever. The run path filtered it out
 * silently while "add test case" posted it as-is and was told it "could not transfer" --
 * one dead selection, two different answers, neither of them the truth. Every consumer
 * now reads through here, and the store itself is pruned once the definitions are known,
 * so a stale key cannot survive to be reported by anything.
 *
 * `null` definitions mean "not yet known" (loading or errored), which is not the same as
 * "known to be empty": while unsettled the selection passes through untouched and nothing
 * is pruned. Treating the pending state as an empty definition set is how a run ends up
 * sent with no selections at all.
 */
export const usePlaceholderSelection = (promptId: number | undefined) => {
	const selectedPlaceholders = usePlaygroundStore((state) => state.selectedPlaceholders);
	const replacePlaceholderSelections = usePlaygroundStore(
		(state) => state.replacePlaceholderSelections,
	);

	const { data: definitions = [], isLoading, isError } = usePromptPlaceholders(promptId);

	const settledDefinitions = isLoading || isError ? null : definitions;

	useEffect(() => {
		if (settledDefinitions === null) return;

		const valid = filterValidPlaceholderSelections(selectedPlaceholders, settledDefinitions);
		if (Object.keys(valid).length === Object.keys(selectedPlaceholders).length) return;

		// Dropping the key is what makes the chips, the run and the test case agree. The
		// author sees the selection disappear from the chip they renamed, which is honest:
		// the value they picked is no longer reachable under that name.
		replacePlaceholderSelections(valid);
	}, [settledDefinitions, selectedPlaceholders, replacePlaceholderSelections]);

	return {
		/** Safe to send: never names a key or value the current definitions do not have. */
		selection: filterValidPlaceholderSelections(selectedPlaceholders, settledDefinitions),
		/** `null` while the definitions are still unknown. */
		definitions: settledDefinitions,
	};
};
