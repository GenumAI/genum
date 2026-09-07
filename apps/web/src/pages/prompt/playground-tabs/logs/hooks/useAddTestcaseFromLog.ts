import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/useToast";
import { useCreateTestcase } from "@/hooks/useCreateTestcase";
import { projectApi } from "@/api/project";
import { promptApi } from "@/api/prompt/prompt.api";
import { spansToSteps } from "@/lib/spansToSteps";
import type { Log } from "@/types/logs";
import type { Step } from "@/types/steps";
import { logsKeys } from "@/query-keys/logs.keys";
import { testcaseKeys } from "@/query-keys/testcases.keys";

/** Stable identity: a fresh `[]` here would re-fire the picker's reset effect forever. */
const NO_STEPS: Step[] = [];

interface UseAddTestcaseFromLogParams {
	promptId?: number;
	selectedLog: Log | null;
}

export function useAddTestcaseFromLog({ promptId, selectedLog }: UseAddTestcaseFromLogParams) {
	const { toast } = useToast();
	const { createTestcase, loading: creatingTestcase } = useCreateTestcase();
	const queryClient = useQueryClient();

	// Non-null while the picker is open: the trajectory to pick from, and the prompt the
	// testcase will hang off, captured at click time so a later selection cannot move it.
	const [pending, setPending] = useState<{ steps: Step[]; promptId: number; log: Log } | null>(
		null,
	);

	const refreshTestcases = useCallback(
		async (targetPromptId: number) => {
			try {
				await queryClient.fetchQuery({
					queryKey: testcaseKeys.promptTestcases(targetPromptId),
					queryFn: async () => {
						const response = await promptApi.getPromptTestcases(targetPromptId);
						return response.testcases || [];
					},
				});
			} catch (error) {
				console.error("Failed to refresh prompt testcases after create from log:", error);
			}
		},
		[queryClient],
	);

	const submit = useCallback(
		async (log: Log, targetPromptId: number, expectedSteps?: Step[]) => {
			try {
				const { ok, unresolvedPlaceholders } = await createTestcase({
					promptId: targetPromptId,
					input: log.in || "",
					expectedOutput: log.out || "",
					lastOutput: log.out || "",
					placeholders: log.placeholders ?? {},
					// Left unset for a text testcase: the backend rejects an empty array,
					// and a testcase that pins no steps is a text testcase by definition.
					...(expectedSteps && expectedSteps.length > 0
						? { expectedSteps, stepsConfig: { orderMatters: false } }
						: {}),
				});

				if (ok) {
					if (unresolvedPlaceholders.length > 0) {
						// A value that has since been renamed or deleted cannot transfer --
						// saying so here is the difference between a partial transfer and a
						// silent one.
						toast({
							title: "Testcase added",
							description: `Testcase was created from log, but these placeholders could not transfer: ${unresolvedPlaceholders.join(", ")}.`,
							variant: "default",
						});
					} else {
						toast({
							title: "Testcase added",
							description: "Testcase was created from log.",
							variant: "default",
						});
					}

					await refreshTestcases(targetPromptId);
					return true;
				}

				toast({
					title: "Failed to add testcase",
					description: "Could not create testcase from log.",
					variant: "destructive",
				});
				return false;
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : "Unknown error";
				toast({
					title: "Error",
					description: message,
					variant: "destructive",
				});
				return false;
			}
		},
		[createTestcase, refreshTestcases, toast],
	);

	const handleAddTestcaseFromLog = useCallback(async () => {
		if (!selectedLog) return;

		const targetPromptId = Number(selectedLog.prompt_id ?? promptId);
		if (!targetPromptId) return;

		if (selectedLog.trace_id) {
			let steps: Step[] = [];
			try {
				const { spans } = await queryClient.fetchQuery({
					queryKey: logsKeys.traceSpans(selectedLog.trace_id),
					queryFn: () => projectApi.getTraceSpans(selectedLog.trace_id as string),
				});
				steps = spansToSteps(spans);
			} catch (error) {
				// The trajectory is telemetry and ages out; the testcase is product data.
				// A trace we cannot read is a reason to fall back to a text testcase, not
				// a reason to refuse to create one.
				console.error("Failed to load trace spans for log:", error);
			}

			if (steps.length > 0) {
				setPending({ steps, promptId: targetPromptId, log: selectedLog });
				return;
			}
		}

		await submit(selectedLog, targetPromptId);
	}, [promptId, queryClient, selectedLog, submit]);

	const confirmSteps = useCallback(
		async (steps: Step[]) => {
			if (!pending) return;
			// Unticked steps ride along so the testcase still shows what was ignored;
			// `compareSteps` skips them.
			const ok = await submit(pending.log, pending.promptId, steps);
			if (ok) setPending(null);
		},
		[pending, submit],
	);

	return {
		handleAddTestcaseFromLog,
		creatingTestcase,
		/** Props for `TestcaseStepPickerDialog`; the picker is open when `steps` is set. */
		stepPicker: {
			open: pending !== null,
			trajectory: pending?.steps ?? NO_STEPS,
			saving: creatingTestcase,
			onCancel: () => setPending(null),
			onConfirm: confirmSteps,
		},
	};
}
