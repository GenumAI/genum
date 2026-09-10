import { useState, useEffect, useMemo, memo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import type { PromptResponse } from "@/api/prompt";
import type { ArgsMatch, Step } from "@/types/steps";
import type { TestCase } from "@/types/TestСase";
import { expectedSaveFor } from "@/lib/expectedSave";
import { turnsOf } from "@/lib/session";
import { liveThread, testcaseThread, type ThreadMessage, type ThreadMetrics } from "@/lib/thread";
import { ConversationThread } from "@/components/thread/ConversationThread";
import { CompareDialog } from "@/components/thread/CompareDialog";
import { usePlaygroundInput } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundInput";
import { usePlaygroundOutput } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundOutput";
import { useTestcaseTrajectory } from "@/pages/prompt/playground-tabs/playground/hooks/useTestcaseTrajectory";
import type { PlaygroundTrajectoryGroup } from "@/pages/prompt/playground-tabs/playground/hooks/types";
import { TestcaseStepPickerDialog } from "@/components/dialogs/TestcaseStepPickerDialog";

import { useExpectedOutput } from "./hooks/useExpectedOutput";
import { useAssertions } from "./hooks/useAssertions";
import { useTestcaseActions } from "./hooks/useTestcaseActions";

import { OutputHeader } from "./components/OutputHeader";
import { OutputActions } from "./components/OutputActions";

export interface UpdateExpected {
	answer: string;
	metrics?: Pick<PromptResponse, "tokens" | "cost" | "response_time_ms" | "status">;
}

interface OutputBlockProps {
	onSaveAsExpected: (content: UpdateExpected) => Promise<void>;
	onTestcaseAdded?: () => void;
	onRegisterClearFunction?: (clearFn: () => void) => void;
	selectedFiles?: Array<{ id: string }>;
	onTestcaseLoadingChange?: (isLoading: boolean) => void;
	isRunning?: boolean;
	serverAssertionType?: string;
	serverAssertionValue?: string;
	/** The live run's steps and controls. */
	trajectory: PlaygroundTrajectoryGroup;
	/** The selected testcase, for its pinned trajectory and its last run's verdict. */
	testcase?: TestCase | null;
}

/**
 * The conversation, and everything done to it.
 *
 * This was three components: a card list for the live run, a step panel for a saved
 * testcase, and a two-column Monaco diff for "the" answer. All three drew the same
 * answer; the diff's expected value was a second view of a step already in the panel; and
 * nothing but a new run cleared the first, so a finished trajectory hid the very buttons
 * this feature exists to feed. One component, one shape, one place to be wrong.
 */
const OutputBlock: React.FC<OutputBlockProps> = ({
	onSaveAsExpected,
	onTestcaseAdded,
	onRegisterClearFunction,
	selectedFiles,
	onTestcaseLoadingChange,
	isRunning,
	serverAssertionType,
	serverAssertionValue,
	trajectory,
	testcase,
}) => {
	const { id } = useParams<{ id: string }>();
	const promptId = id ? Number(id) : undefined;
	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");

	const { outputContent: content } = usePlaygroundOutput({ promptId, testcaseId });
	const { inputContent: inputValue } = usePlaygroundInput({ promptId, testcaseId });
	const { toast } = useToast();

	const [isOpenAssertion, setIsOpenAssertion] = useState(false);
	/** The answer whose fullscreen comparison is open, by flat index; null when closed. */
	const [compareIndex, setCompareIndex] = useState<number | null>(null);
	const [confirmingRemoval, setConfirmingRemoval] = useState(false);

	const {
		modifiedValue,
		clearExpectedOutput,
		saveModifiedValue,
		handleSaveAsExpected: handleSaveAsExpectedFromHook,
	} = useExpectedOutput({ onSaveAsExpected, testcaseId, promptId });

	const {
		currentAssertionType,
		assertionValue,
		handleAssertionTypeChange,
		handleAssertionValueChange,
		handleAssertionValueBlur,
	} = useAssertions({ promptId, serverAssertionType, serverAssertionValue });

	const pinned = useTestcaseTrajectory({ testcaseId, testcase });

	const { isTestcaseLoading, createTestcase, stepPicker } = useTestcaseActions({
		promptId,
		onTestcaseAdded,
		selectedFiles,
		trajectorySteps: trajectory.steps,
	});

	useEffect(() => {
		if (onRegisterClearFunction) onRegisterClearFunction(clearExpectedOutput);
	}, [onRegisterClearFunction, clearExpectedOutput]);
	useEffect(() => {
		if (onTestcaseLoadingChange) onTestcaseLoadingChange(isTestcaseLoading);
	}, [isTestcaseLoading, onTestcaseLoadingChange]);

	/**
	 * The last run's usage. Measured, so it may be shown -- unlike a recorded span's,
	 * which is a zero placeholder (D5). Memoized because `messages` depends on it: a
	 * fresh object every render would defeat that memo and rebuild the whole thread on any
	 * keystroke anywhere on the page.
	 */
	const runMetrics: ThreadMetrics | undefined = useMemo(
		() =>
			content
				? {
						tokens: content.tokens?.total ?? 0,
						cost: content.cost?.total ?? 0,
						responseTimeMs: content.response_time_ms ?? 0,
					}
				: undefined,
		[content],
	);

	/**
	 * The flat index of the run's last answer, or null if it has none.
	 *
	 * Without a pinned trajectory a testcase stores exactly ONE expected answer, the
	 * `expectedOutput` column, and the server reads it back as the last enabled final.
	 * So that is the only answer whose expectation can be kept: offering an editable
	 * field on an earlier turn would take the author's words and drop them on the next
	 * refetch. Once a trajectory is pinned, every turn has a step to hold its own.
	 */
	const lastFinalIndex = useMemo(() => {
		// No `findLastIndex`: apps/web targets ES2020.
		for (let index = trajectory.steps.length - 1; index >= 0; index--) {
			if (trajectory.steps[index].kind === "final") return index;
		}
		return null;
	}, [trajectory.steps]);

	/**
	 * Which answers may carry an expectation. `undefined` means all of them, which is the
	 * case once a trajectory is pinned. Passed to the thread rather than decided inside
	 * it: only this component knows where the expectation would be stored.
	 */
	const expectedEditable: Set<number> | undefined = useMemo(() => {
		if (pinned.hasTrajectory) return undefined;
		if (trajectory.steps.length === 0) return new Set([0]);
		return lastFinalIndex === null ? new Set<number>() : new Set([lastFinalIndex]);
	}, [pinned.hasTrajectory, trajectory.steps.length, lastFinalIndex]);

	/**
	 * Whether what is on screen is the LIVE run's thread, as opposed to a saved testcase's
	 * or the one-message fallback. It is the same condition the `messages` memo below
	 * branches on, and it decides whether a reply can be sent at all: a reply is a
	 * continuation of the conversation being rendered, so a thread that is not the live one
	 * has no conversation to continue.
	 */
	const isLiveThread = !pinned.hasTrajectory && trajectory.steps.length > 0;

	const messages: ThreadMessage[] = useMemo(() => {
		// A testcase with a pinned trajectory: the expectation IS the trajectory, and the
		// last run's steps are what it is measured against.
		if (pinned.hasTrajectory) {
			return testcaseThread({
				expectedSteps: pinned.steps,
				lastSteps: Array.isArray(testcase?.lastSteps) ? (testcase.lastSteps as Step[]) : [],
				mismatches: pinned.mismatchByIndex,
				comparisonRecorded: pinned.comparisonRecorded,
			});
		}

		// A run in the playground. Only the LAST turn's metrics survive in `content` --
		// each response overwrites the previous -- so they go on the last turn and nowhere
		// else. Spreading them over every turn would attribute one turn's cost to all.
		if (trajectory.steps.length > 0) {
			const turnCount = turnsOf(trajectory.steps).length;
			const metricsByTurn: (ThreadMetrics | undefined)[] = new Array(turnCount).fill(
				undefined,
			);
			if (runMetrics && turnCount > 0) metricsByTurn[turnCount - 1] = runMetrics;
			return liveThread({
				steps: trajectory.steps,
				metricsByTurn,
				// ONE source for the expectation, and it is `modifiedValue` -- the same
				// value `saveModifiedValue` writes and the testcase persists. A second
				// in-memory store here is exactly how "Save as expected" appeared to do
				// nothing: it wrote one of them and the thread rendered the other.
				expectedByIndex: lastFinalIndex === null ? {} : { [lastFinalIndex]: modifiedValue },
			});
		}

		// A text testcase, or a testcase selected but not yet run: a thread of one message
		// (D6). Its expectation is the `expectedOutput` column itself, never a synthesized
		// one-element `expectedSteps` array -- that would move the testcase onto trajectory
		// comparison behind the author's back.
		if (!content?.answer && !modifiedValue) return [];
		return [
			{
				step: { kind: "final", text: modifiedValue },
				index: 0,
				...(content?.answer !== undefined ? { produced: content.answer } : {}),
				...(runMetrics ? { metrics: runMetrics } : {}),
			},
		];
	}, [
		pinned.hasTrajectory,
		pinned.steps,
		pinned.mismatchByIndex,
		pinned.comparisonRecorded,
		testcase?.lastSteps,
		trajectory.steps,
		lastFinalIndex,
		content?.answer,
		modifiedValue,
		runMetrics,
	]);

	const alreadyReported = () => {};

	const handleExpectedChange = async (index: number, text: string): Promise<boolean> => {
		const save = expectedSaveFor({
			hasTestcase: !!testcaseId,
			hasTrajectory: pinned.hasTrajectory,
			index,
			text,
		});
		if (save.kind === "expectedSteps") return pinned.setStepText(save.index, save.text);
		// `expectedOutput` and `draft` land on the same call on purpose:
		// `saveModifiedValue` updates the value the thread renders and then persists it
		// ONLY when a testcase exists, which is precisely D7. Splitting them was what
		// gave the expectation two homes.
		await saveModifiedValue(save.kind === "expectedOutput" ? save.answer : save.text);
		return true;
	};

	const handleSaveAsExpected = async (index: number) => {
		const produced = messages.find((message) => message.index === index)?.produced;
		if (produced === undefined) return;

		// A trajectory's answers each save their own step; a text testcase has one answer
		// and the older whole-output path already writes it, its metrics included.
		if (pinned.hasTrajectory) {
			await handleExpectedChange(index, produced);
			return;
		}
		const result = await handleSaveAsExpectedFromHook();
		if (result.success) {
			toast({
				title: "Saved as expected",
				description: "This answer is now what the testcase expects.",
			});
		}
	};

	const handleAddTestcase = async () => {
		await createTestcase(inputValue || "", modifiedValue, content?.answer || "");
		// "deferred" opens the step picker (rendered below); the hook finishes the create
		// once the author confirms which steps to pin.
	};

	const compared =
		compareIndex === null ? undefined : messages.find((m) => m.index === compareIndex);
	const comparedTurn =
		compared === undefined
			? 1
			: messages.filter(
					(message) => message.step.kind === "user" && message.index <= compared.index,
				).length + 1;

	return (
		<div className="w-full min-w-0">
			<OutputHeader
				promptId={promptId}
				currentAssertionType={currentAssertionType}
				assertionValue={assertionValue}
				isOpenAssertion={isOpenAssertion}
				onOpenAssertionChange={setIsOpenAssertion}
				onAssertionTypeChange={handleAssertionTypeChange}
				onAssertionValueChange={handleAssertionValueChange}
				onAssertionValueBlur={handleAssertionValueBlur}
				setAssertionValue={handleAssertionValueChange}
				toast={toast}
			/>

			<ConversationThread
				messages={messages}
				// Only the LIVE thread gets live controls, which is what the prop always
				// meant ("absent on a saved testcase") and not what it was given.
				//
				// Passed unconditionally, "+ Add message" appeared on a saved testcase too.
				// On a pinned trajectory the reply went out as a conversation of one message
				// -- a real, billed model call with no history -- and the `messages` memo
				// stayed on the pinned branch, so neither the reply nor the answer was ever
				// rendered: the author saw the box close and nothing happen. On a text
				// testcase it was worse, because the first reply put a step into
				// `trajectory.steps` and flipped the memo to the live branch, replacing the
				// original question and answer on screen with the reply alone.
				live={
					isLiveThread
						? {
								pendingTool: trajectory.pendingTool,
								isRunning: isRunning === true,
								onToolResult: trajectory.onToolResult,
								onReply: trajectory.onReply,
								error: trajectory.error,
								onRetry: trajectory.onRetry,
							}
						: undefined
				}
				saving={pinned.saving}
				orderMatters={pinned.stepsConfig.orderMatters}
				onOrderMattersChange={
					pinned.hasTrajectory
						? (value) => {
								pinned.setOrderMatters(value).catch(alreadyReported);
							}
						: undefined
				}
				onEnabledChange={
					pinned.hasTrajectory
						? (index, enabled) => {
								if (!enabled && pinned.wouldEmptyTrajectory(index)) {
									setConfirmingRemoval(true);
									return;
								}
								pinned.setStepEnabled(index, enabled).catch(alreadyReported);
							}
						: undefined
				}
				onArgsMatchChange={
					pinned.hasTrajectory
						? (index: number, argsMatch: ArgsMatch) => {
								pinned.setStepArgsMatch(index, argsMatch).catch(alreadyReported);
							}
						: undefined
				}
				expectedEditableIndices={expectedEditable}
				onExpectedChange={handleExpectedChange}
				onSaveAsExpected={handleSaveAsExpected}
				onCompare={setCompareIndex}
			/>

			{confirmingRemoval && (
				<div className="mt-3 flex flex-col gap-2 rounded-[6px] border border-destructive p-3">
					<p className="text-sm">
						That was the last checked step. A testcase that asserts nothing always
						passes, so the trajectory has to go with it — the testcase stays, as a plain
						text one.
					</p>
					<div className="flex gap-2">
						<Button
							variant="destructive"
							disabled={pinned.saving}
							onClick={() => {
								pinned
									.removeTrajectory()
									.then(() => setConfirmingRemoval(false))
									.catch(alreadyReported);
							}}
						>
							Remove the trajectory
						</Button>
						<Button
							variant="outline"
							disabled={pinned.saving}
							onClick={() => setConfirmingRemoval(false)}
						>
							Cancel
						</Button>
					</div>
				</div>
			)}

			<OutputActions
				// A run has produced something. `messages` is not the test: a testcase
				// selected but never run has messages (its expectation) and nothing to
				// build a new testcase from.
				hasOutput={!!content?.answer}
				testcaseId={testcaseId}
				isTestcaseLoading={isTestcaseLoading}
				modifiedValue={modifiedValue}
				onAddTestcase={handleAddTestcase}
				isRunning={isRunning}
			/>

			{compared && (
				<CompareDialog
					open
					onOpenChange={(open) => {
						if (!open) setCompareIndex(null);
					}}
					turnNumber={comparedTurn}
					produced={compared.produced ?? ""}
					expected={compared.step.kind === "final" ? compared.step.text : ""}
					onExpectedChange={(text) => {
						handleExpectedChange(compared.index, text).catch(alreadyReported);
					}}
				/>
			)}

			{stepPicker.open && <TestcaseStepPickerDialog {...stepPicker} />}
		</div>
	);
};

export default memo(OutputBlock);
