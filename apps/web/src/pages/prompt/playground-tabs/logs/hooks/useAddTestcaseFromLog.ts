import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/useToast";
import { useCreateTestcase } from "@/hooks/useCreateTestcase";
import { projectApi } from "@/api/project";
import { promptApi } from "@/api/prompt/prompt.api";
import { spansToSteps } from "@/lib/spansToSteps";
import type { Log, LogDetail } from "@/types/logs";
import type { Step } from "@/types/steps";
import { logsKeys } from "@/query-keys/logs.keys";
import { testcaseKeys } from "@/query-keys/testcases.keys";

/** Stable identity: a fresh `[]` here would re-fire the picker's reset effect forever. */
const NO_STEPS: Step[] = [];
/** Same reasoning as `NO_STEPS`, for the closed-picker default of `unreadableArgsIndices`. */
const NO_UNREADABLE_ARGS: Set<number> = new Set();

interface UseAddTestcaseFromLogParams {
	promptId?: number;
	selectedLog: Log | null;
	/**
	 * The payload of `selectedLog`. A testcase IS its input and output, so this is not
	 * optional context -- without it there is nothing to create, hence the guard below.
	 */
	logDetail: LogDetail | null;
}

export function useAddTestcaseFromLog({
	promptId,
	selectedLog,
	logDetail,
}: UseAddTestcaseFromLogParams) {
	const { toast } = useToast();
	const { createTestcase, loading: creatingTestcase } = useCreateTestcase();
	const queryClient = useQueryClient();

	// Non-null while the picker is open: the trajectory to pick from, and the prompt the
	// testcase will hang off, captured at click time so a later selection cannot move it.
	const [pending, setPending] = useState<{
		steps: Step[];
		unreadableArgsIndices: Set<number>;
		promptId: number;
		/**
		 * The payload, captured at click time. A list row carries no `in`/`out` any more,
		 * so the detail is what a testcase is actually made of -- and capturing it here
		 * means a selection change while the picker is open cannot move it.
		 */
		detail: LogDetail;
	} | null>(null);

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
		async (
			detail: LogDetail,
			targetPromptId: number,
			expectedSteps?: Step[],
			// True when the log carried a trace_id but the recorded trajectory could not be
			// turned into steps (the span fetch failed, or it came back empty) -- the author
			// asked for tool-call assertions and is about to get a plain text testcase
			// instead. Logging to console.error and falling through silently would leave
			// them believing they pinned tool calls when they pinned nothing.
			traceUnavailable = false,
		) => {
			try {
				const { ok, unresolvedPlaceholders } = await createTestcase({
					promptId: targetPromptId,
					input: detail.in || "",
					expectedOutput: detail.out || "",
					lastOutput: detail.out || "",
					placeholders: detail.placeholders ?? {},
					// Left unset for a text testcase: the backend rejects an empty array,
					// and a testcase that pins no steps is a text testcase by definition.
					...(expectedSteps && expectedSteps.length > 0
						? { expectedSteps, stepsConfig: { orderMatters: false } }
						: {}),
				});

				if (ok) {
					// Composable: an author can hit both the trace warning and the
					// unresolved-placeholder warning on the same create, and both must show.
					const notes: string[] = [];
					if (traceUnavailable) {
						notes.push(
							"the recorded trajectory could not be loaded, so no steps were pinned",
						);
					}
					if (unresolvedPlaceholders.length > 0) {
						notes.push(
							`these placeholders could not transfer: ${unresolvedPlaceholders.join(", ")}`,
						);
					}

					toast({
						title: "Testcase added",
						description:
							notes.length > 0
								? `Testcase was created from log; ${notes.join("; ")}.`
								: "Testcase was created from log.",
						variant: "default",
					});

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
		// `logDetail` is still loading, or failed: creating a testcase now would silently
		// make an empty one.
		if (!selectedLog || !logDetail) return;

		const targetPromptId = Number(selectedLog.prompt_id ?? promptId);
		if (!targetPromptId) return;

		if (selectedLog.trace_id) {
			let steps: Step[] = [];
			let unreadableArgsIndices: Set<number> = NO_UNREADABLE_ARGS;
			try {
				const { spans } = await queryClient.fetchQuery({
					queryKey: logsKeys.traceSpans(selectedLog.trace_id),
					queryFn: () => projectApi.getTraceSpans(selectedLog.trace_id as string),
				});
				({ steps, unreadableArgsIndices } = spansToSteps(spans));
			} catch (error) {
				// The trajectory is telemetry and ages out; the testcase is product data.
				// A trace we cannot read is a reason to fall back to a text testcase, not
				// a reason to refuse to create one -- but the author still needs to know.
				console.error("Failed to load trace spans for log:", error);
			}

			if (steps.length > 0) {
				setPending({
					steps,
					unreadableArgsIndices,
					promptId: targetPromptId,
					detail: logDetail,
				});
				return;
			}

			// Either the fetch failed above, or it succeeded with no spans to turn into
			// steps -- either way, the author asked for a trajectory testcase and is about
			// to get a plain text one. `traceUnavailable: true` surfaces that in the toast
			// instead of leaving them to believe they pinned tool calls.
			await submit(logDetail, targetPromptId, undefined, true);
			return;
		}

		await submit(logDetail, targetPromptId);
	}, [logDetail, promptId, queryClient, selectedLog, submit]);

	const confirmSteps = useCallback(
		async (steps: Step[]) => {
			if (!pending) return;
			// Unticked steps ride along so the testcase still shows what was ignored;
			// `compareSteps` skips them.
			const ok = await submit(pending.detail, pending.promptId, steps);
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
			unreadableArgsIndices: pending?.unreadableArgsIndices ?? NO_UNREADABLE_ARGS,
			saving: creatingTestcase,
			onCancel: () => setPending(null),
			onConfirm: confirmSteps,
		},
	};
}
