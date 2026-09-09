import { useCallback, useEffect, type MutableRefObject } from "react";
import { promptApi } from "@/api/prompt";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { formatTestcaseOutput } from "@/lib/formatTestcaseOutput";
import { useToast } from "@/hooks/useToast";
import type { PromptResponse } from "@/api/prompt";
import type { PromptSettings } from "@/types/Prompt";
import type { TestCase } from "@/types/TestСase";
import type { FileMetadata } from "@/api/files";
import type { ConversationMessage, ToolCallStep } from "@/types/steps";
import type { TrajectoryDraft } from "@/stores/playground.store";
import { useQueryClient } from "@tanstack/react-query";
import { testcaseKeys } from "@/query-keys/testcases.keys";
import { usePromptActions } from "@/stores/prompt.store";
import { usePlaceholderSelection } from "./usePlaceholderSelection";

export function usePlaygroundPromptRun({
	promptId,
	testcaseId,
	testcase,
	inputContent,
	storeOutputContent,
	wasRun,
	currentAssertionType,
	promptSettings,
	selectedFiles,
	trajectory,
	setTrajectory,
	clearTrajectory,
	trajectoryGeneration,
	setRunState,
	setOutputContent,
	setStatus,
	openAssertionModal,
}: {
	promptId: number | undefined;
	testcaseId: string | null;
	testcase: TestCase | null;
	inputContent: string;
	storeOutputContent: PromptResponse | null;
	wasRun: boolean;
	currentAssertionType: string;
	promptSettings: PromptSettings | undefined;
	selectedFiles: FileMetadata[];
	trajectory: TrajectoryDraft;
	setTrajectory: (updater: (prev: TrajectoryDraft) => TrajectoryDraft) => void;
	clearTrajectory: () => void;
	/** Bumped whenever the trajectory is discarded; see `usePlaygroundTrajectory`. */
	trajectoryGeneration: MutableRefObject<number>;
	setRunState: (state: { loading: boolean; wasRun?: boolean }) => void;
	setOutputContent: (value: PromptResponse | null) => void;
	setStatus: (status: string) => void;
	openAssertionModal: () => void;
}) {
	const { toast } = useToast();
	const { setRunLoading, setRunError, setLastRunResult } = usePromptActions();
	const queryClient = useQueryClient();
	// One reading of the selection, shared with "add test case" -- see the hook for why
	// two independent readings of it produced two different answers about the same key.
	const { selection: placeholderSelection } = usePlaceholderSelection(promptId);

	// The chips are computed from the live draft, but the server renders the SAVED
	// Prompt.value (the editor only saves on fieldset blur). A selection made after
	// typing a new {{key}} but before that save lands in `ignored`, not the answer --
	// silently, unless this names the keys back to the author. `ignored` can also mean
	// a value name that no longer resolves (stale cache, a renamed value), so the
	// message states what happened, not why.
	const warnAboutIgnoredPlaceholders = useCallback(
		(ignored: string[] | undefined) => {
			if (!ignored || ignored.length === 0) return;
			toast({
				title: "Some placeholder selections were not applied",
				description: `These keys were not applied to this run: ${ignored.join(", ")}.`,
				variant: "default",
			});
		},
		[toast],
	);

	const handleRun = useCallback(async () => {
		if (!promptId) return;

		// A fresh "Run" starts a new trajectory, discarding any earlier one still waiting
		// on tool results for this prompt/testcase -- the author asked to run again, not
		// to continue the interrupted one.
		clearTrajectory();
		setRunState({ loading: true });
		setRunLoading(true);
		setRunError(null);

		try {
			const runParams = {
				question: inputContent,
				...(selectedFiles.length > 0 && { files: selectedFiles.map((f) => f.id) }),
				placeholders: placeholderSelection,
			};

			if (!testcaseId) {
				// A second "Run" pressed while this one is in flight discards this
				// trajectory (via clearTrajectory above); a response that lands after must
				// not seed the trajectory -- or its traceId -- that replaced it.
				const generation = trajectoryGeneration.current;
				const result = await promptApi.runPrompt(promptId, runParams);
				if (trajectoryGeneration.current !== generation) return;
				if (result) {
					setLastRunResult(result);
					setOutputContent(result);
					warnAboutIgnoredPlaceholders(result.placeholders?.ignored);

					// The tool is never executed by Genum: the run pauses here and the author
					// types the result in (see handleToolResult), which is what turns this
					// into a recordable, later replayable trajectory.
					const toolCalls = result.toolCalls;
					if (toolCalls && toolCalls.length > 0) {
						const steps: ToolCallStep[] = toolCalls.map((call) => ({
							kind: "tool_call",
							name: call.name,
							args: call.args,
						}));
						setTrajectory(() => ({
							steps,
							messages: [{ role: "assistant", content: result.answer, toolCalls }],
							pending: toolCalls.map((call, index) => ({ call, stepIndex: index })),
							// Minted by the server for this turn; every continuation
							// echoes it back so the turns log as one run, not N.
							traceId: result.traceId ?? null,
						}));
					}
				}
				return;
			}

			const testcaseResponse = await testcasesApi.runTestcase(testcaseId, runParams);
			const updatedTestcase = testcaseResponse?.testcase;
			if (updatedTestcase) {
				queryClient.setQueryData<TestCase[] | undefined>(
					testcaseKeys.promptTestcases(promptId),
					(previous) =>
						previous?.map((item) =>
							item.id === updatedTestcase.id ? updatedTestcase : item,
						) ?? previous,
				);
				queryClient.setQueryData<{ testcase: TestCase } | undefined>(
					testcaseKeys.byId(testcaseId),
					(previous) => ({ ...previous, testcase: updatedTestcase }),
				);
			}
			const result = formatTestcaseOutput(testcaseResponse);

			if (result) {
				setLastRunResult(result);
				setOutputContent(result);
				warnAboutIgnoredPlaceholders(result.placeholders?.ignored);
				setRunState({ loading: false, wasRun: true });
				return;
			}
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error("Failed to run prompt/testcase");
			console.error("Failed to run prompt/testcase:", err);
			setRunError(error.message);
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
				duration: 6000,
			});
			if (testcaseId && promptId) {
				queryClient.invalidateQueries({
					queryKey: testcaseKeys.promptTestcases(promptId),
				});
			}
		} finally {
			setRunState({ loading: false });
			setRunLoading(false);
		}
	}, [
		inputContent,
		promptId,
		selectedFiles,
		placeholderSelection,
		setRunState,
		setOutputContent,
		testcaseId,
		queryClient,
		setRunLoading,
		setRunError,
		setLastRunResult,
		toast,
		warnAboutIgnoredPlaceholders,
		clearTrajectory,
		setTrajectory,
		trajectoryGeneration,
	]);

	// The author supplied a result for the tool the run is paused on. Once every tool
	// call from the last turn has a result, the accumulated conversation is sent back so
	// the model can continue -- an empty string is a valid, deliberate result (e.g. a
	// tool that legitimately returns nothing) and is sent through unchanged.
	const handleToolResult = useCallback(
		async (name: string, result: string) => {
			if (!promptId) return;

			const [front, ...restPending] = trajectory.pending;
			if (!front) return;
			// The queue, not the argument, is authoritative for which call this resolves --
			// `name` only round-trips what TrajectorySteps was showing, so a mismatch means
			// the UI and the queue drifted apart rather than a case to special-case here.
			if (front.call.name !== name) {
				console.warn(
					`Tool result for "${name}" applied to pending call "${front.call.name}"; the trajectory queue may be out of sync.`,
				);
			}

			const toolMessage: ConversationMessage = {
				role: "tool",
				toolCallId: front.call.id,
				name: front.call.name,
				content: result,
			};
			const messagesSoFar = [...trajectory.messages, toolMessage];
			const stepsSoFar = trajectory.steps.map((step, index) =>
				index === front.stepIndex && step.kind === "tool_call"
					? { ...step, recordedResult: result }
					: step,
			);

			if (restPending.length > 0) {
				// More tool calls from the same turn are still waiting on a result.
				setTrajectory((prev) => ({
					...prev,
					steps: stepsSoFar,
					messages: messagesSoFar,
					pending: restPending,
				}));
				return;
			}

			const traceId = trajectory.traceId;
			setTrajectory((prev) => ({
				...prev,
				steps: stepsSoFar,
				messages: messagesSoFar,
				pending: [],
			}));
			// The Run button's spinner is fed by the session store, not the prompt store:
			// without this the whole continuation round trip showed no sign of life --
			// `pendingTool` is already null, so the pane is just a static list.
			setRunState({ loading: true });
			setRunLoading(true);
			setRunError(null);
			// A "Run" (or a testcase/prompt switch) mid-flight discards this trajectory;
			// the response that lands afterwards must not write into whatever replaced it.
			const generation = trajectoryGeneration.current;

			try {
				const nextResult = await promptApi.runPrompt(promptId, {
					question: inputContent,
					...(selectedFiles.length > 0 && { files: selectedFiles.map((f) => f.id) }),
					placeholders: placeholderSelection,
					messages: messagesSoFar,
					...(traceId ? { traceId } : {}),
				});
				if (trajectoryGeneration.current !== generation) return;
				setLastRunResult(nextResult);
				setOutputContent(nextResult);
				warnAboutIgnoredPlaceholders(nextResult.placeholders?.ignored);

				const nextToolCalls = nextResult.toolCalls;
				if (nextToolCalls && nextToolCalls.length > 0) {
					const baseIndex = stepsSoFar.length;
					const newSteps: ToolCallStep[] = nextToolCalls.map((call) => ({
						kind: "tool_call",
						name: call.name,
						args: call.args,
					}));
					setTrajectory((prev) => ({
						...prev,
						steps: [...prev.steps, ...newSteps],
						messages: [
							...prev.messages,
							{
								role: "assistant",
								content: nextResult.answer,
								toolCalls: nextToolCalls,
							},
						],
						pending: nextToolCalls.map((call, index) => ({
							call,
							stepIndex: baseIndex + index,
						})),
					}));
				} else {
					setTrajectory((prev) => ({
						...prev,
						steps: [...prev.steps, { kind: "final", text: nextResult.answer }],
						messages: prev.messages,
						pending: [],
					}));
				}
			} catch (err: unknown) {
				if (trajectoryGeneration.current !== generation) return;
				const error = err instanceof Error ? err : new Error("Failed to continue the run");
				console.error("Failed to continue the agentic run:", err);
				setRunError(error.message);
				toast({
					title: "Error",
					description: error.message,
					variant: "destructive",
					duration: 6000,
				});
			} finally {
				// A newer run owns the spinner now; clearing it here would hide theirs.
				if (trajectoryGeneration.current === generation) {
					setRunState({ loading: false });
					setRunLoading(false);
				}
			}
		},
		[
			promptId,
			trajectory,
			setTrajectory,
			trajectoryGeneration,
			inputContent,
			selectedFiles,
			placeholderSelection,
			setRunState,
			setRunLoading,
			setRunError,
			setLastRunResult,
			setOutputContent,
			warnAboutIgnoredPlaceholders,
			toast,
		],
	);

	// The author typed a follow-up after the model's final answer. Mirrors
	// `handleToolResult`'s continuation shape (append, send, branch on the next tool
	// calls) with a `user` message instead of a `tool` one, and the same generation
	// guard: a fresh "Run" mid-flight must discard this continuation exactly the same
	// way it discards a tool-result continuation.
	const handleReply = useCallback(
		async (text: string) => {
			if (!promptId) return;
			// A pending tool call means the session is not actually waiting on the author's
			// words yet -- TrajectorySteps only shows this control once it is, but a stale
			// callback closed over an earlier render must not send a reply into the middle
			// of an unresolved tool cycle.
			if (trajectory.pending.length > 0) return;

			const userMessage: ConversationMessage = { role: "user", content: text };
			const messagesSoFar = [...trajectory.messages, userMessage];
			const stepsSoFar: typeof trajectory.steps = [
				...trajectory.steps,
				{ kind: "user", text },
			];

			const traceId = trajectory.traceId;
			setTrajectory((prev) => ({
				...prev,
				steps: stepsSoFar,
				messages: messagesSoFar,
			}));
			// Same reason as in handleToolResult: the Run button's spinner is fed by the
			// session store, not the prompt store.
			setRunState({ loading: true });
			setRunLoading(true);
			setRunError(null);
			// A "Run" (or a testcase/prompt switch) mid-flight discards this trajectory;
			// the response that lands afterwards must not write into whatever replaced it.
			const generation = trajectoryGeneration.current;

			try {
				const nextResult = await promptApi.runPrompt(promptId, {
					question: inputContent,
					...(selectedFiles.length > 0 && { files: selectedFiles.map((f) => f.id) }),
					placeholders: placeholderSelection,
					messages: messagesSoFar,
					...(traceId ? { traceId } : {}),
				});
				if (trajectoryGeneration.current !== generation) return;
				setLastRunResult(nextResult);
				setOutputContent(nextResult);
				warnAboutIgnoredPlaceholders(nextResult.placeholders?.ignored);

				const nextToolCalls = nextResult.toolCalls;
				if (nextToolCalls && nextToolCalls.length > 0) {
					const baseIndex = stepsSoFar.length;
					const newSteps: ToolCallStep[] = nextToolCalls.map((call) => ({
						kind: "tool_call",
						name: call.name,
						args: call.args,
					}));
					setTrajectory((prev) => ({
						...prev,
						steps: [...prev.steps, ...newSteps],
						messages: [
							...prev.messages,
							{
								role: "assistant",
								content: nextResult.answer,
								toolCalls: nextToolCalls,
							},
						],
						pending: nextToolCalls.map((call, index) => ({
							call,
							stepIndex: baseIndex + index,
						})),
					}));
				} else {
					setTrajectory((prev) => ({
						...prev,
						steps: [...prev.steps, { kind: "final", text: nextResult.answer }],
						messages: prev.messages,
						pending: [],
					}));
				}
			} catch (err: unknown) {
				if (trajectoryGeneration.current !== generation) return;
				const error = err instanceof Error ? err : new Error("Failed to continue the run");
				console.error("Failed to continue the agentic run:", err);
				setRunError(error.message);
				toast({
					title: "Error",
					description: error.message,
					variant: "destructive",
					duration: 6000,
				});
			} finally {
				// A newer run owns the spinner now; clearing it here would hide theirs.
				if (trajectoryGeneration.current === generation) {
					setRunState({ loading: false });
					setRunLoading(false);
				}
			}
		},
		[
			promptId,
			trajectory,
			setTrajectory,
			trajectoryGeneration,
			inputContent,
			selectedFiles,
			placeholderSelection,
			setRunState,
			setRunLoading,
			setRunError,
			setLastRunResult,
			setOutputContent,
			warnAboutIgnoredPlaceholders,
			toast,
		],
	);

	useEffect(() => {
		if (!storeOutputContent || !testcaseId || !testcase || !wasRun) {
			return;
		}

		setStatus(storeOutputContent.status);
		const assertionType = currentAssertionType || promptSettings?.assertionType;
		if (assertionType === "AI" || assertionType === "STRICT") {
			openAssertionModal();
		}
		setRunState({ loading: false, wasRun: false });
	}, [
		storeOutputContent,
		testcaseId,
		testcase,
		wasRun,
		currentAssertionType,
		promptSettings?.assertionType,
		setStatus,
		openAssertionModal,
		setRunState,
	]);

	return { handleRun, handleToolResult, handleReply };
}
