import { useState } from "react";

import { Loader2 } from "lucide-react";

import { StepRow } from "@/components/steps/StepRow";
import { TurnSection } from "@/components/steps/TurnSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { canAddMessage, type ThreadMessage } from "@/lib/thread";
import type { ArgsMatch } from "@/types/steps";

/** The live run's controls. Absent on a saved testcase and in a read-only rendering. */
export interface ThreadLiveControls {
	/** Tool the run is paused on, waiting for the author to supply a result. */
	pendingTool: string | null;
	/** A turn is in flight. */
	isRunning: boolean;
	onToolResult: (name: string, result: string) => void;
	onReply: (text: string) => void;
	/** The last continuation's round trip failed, with this message; null otherwise. */
	error: string | null;
	onRetry: () => void;
}

export interface ConversationThreadProps {
	messages: ThreadMessage[];
	live?: ThreadLiveControls;
	orderMatters?: boolean;
	onOrderMattersChange?: (value: boolean) => void;
	readOnly?: boolean;
	/** A write is in flight; every control freezes. */
	saving?: boolean;
	onEnabledChange?: (index: number, enabled: boolean) => void;
	onArgsMatchChange?: (index: number, argsMatch: ArgsMatch) => void;
	/**
	 * Flat indices of the answers that may carry an expectation. `undefined` means all of
	 * them. An answer left out shows what it produced and no expected field at all --
	 * because without somewhere to store it, a field would take the author's words and
	 * lose them on the next refetch, which is worse than not offering one.
	 */
	expectedEditableIndices?: Set<number>;
	onExpectedChange?: (
		index: number,
		text: string,
	) => boolean | undefined | Promise<boolean | undefined>;
	onSaveAsExpected?: (index: number) => void;
	onCompare?: (index: number) => void;
}

interface Group {
	/** The flat index the group starts at -- what `TurnSection`'s key needs. */
	start: number;
	messages: ThreadMessage[];
}

/**
 * Splits an already-flattened message list into turns. Same rule as `turnsOf`: a turn
 * begins at each user reply, and the first turn has no reply of its own because its
 * question is the testcase's input. Applied to messages rather than steps so the flat
 * index each message already carries is preserved -- recomputing it here is how a save
 * ends up addressing the wrong step.
 */
function groupIntoTurns(messages: ThreadMessage[]): Group[] {
	const groups: Group[] = [];
	let current: ThreadMessage[] = [];

	for (const message of messages) {
		if (message.step.kind === "user" && current.length > 0) {
			groups.push({ start: current[0].index, messages: current });
			current = [];
		}
		current.push(message);
	}
	if (current.length > 0) {
		groups.push({ start: current[0].index, messages: current });
	}
	return groups;
}

/**
 * The one rendering of a conversation.
 *
 * It replaced three: a card list for the live run, a step panel for a saved testcase, and
 * a two-column diff for the answer. All three drew the same answer, none knew about the
 * others, and the expected value in the third was a second view of a step already in the
 * second. One component means one place where a turn's answer, its expectation and its
 * verdict can disagree -- and that place now has tests.
 */
export function ConversationThread({
	messages,
	live,
	orderMatters,
	onOrderMattersChange,
	readOnly = false,
	saving = false,
	expectedEditableIndices,
	onEnabledChange,
	onArgsMatchChange,
	onExpectedChange,
	onSaveAsExpected,
	onCompare,
}: ConversationThreadProps) {
	const [result, setResult] = useState("");
	const [reply, setReply] = useState("");
	const [replying, setReplying] = useState(false);

	// An empty frame is worse than no frame: it says a conversation exists and is empty,
	// when in fact none has started.
	if (messages.length === 0) return null;

	const canReply =
		live !== undefined &&
		canAddMessage({
			steps: messages.map((message) => message.step),
			pendingTool: live.pendingTool,
			isRunning: live.isRunning,
		});

	return (
		<div className="flex flex-col gap-4">
			{groupIntoTurns(messages).map((group, turnPosition) => {
				const live_ = group.messages.filter(
					(message) => message.outcome !== "not-reached",
				).length;
				return (
					<TurnSection
						key={group.start}
						turnNumber={turnPosition + 1}
						liveStepCount={live_ === 0 ? null : live_}
						totalStepCount={group.messages.length}
						hasMismatch={group.messages.some(
							(message) => message.outcome === "mismatched",
						)}
						// The turn holding the unticked reply that ends the session. Derived
						// from the reply itself rather than from a cut index passed in: the
						// two cannot then disagree, and the reply IS the cut.
						isCutTurn={group.messages.some(
							(message) =>
								message.step.kind === "user" && message.step.enabled === false,
						)}
					>
						{group.messages.map((message) => {
							const expectable =
								expectedEditableIndices === undefined ||
								expectedEditableIndices.has(message.index);
							return (
								<StepRow
									key={`${message.step.kind}-${message.index}`}
									step={message.step}
									produced={message.produced}
									metrics={message.metrics}
									outcome={message.outcome}
									outcomeReason={message.outcomeReason}
									readOnly={readOnly}
									disabled={saving || message.outcome === "not-reached"}
									onEnabledChange={
										onEnabledChange &&
										((enabled) => onEnabledChange(message.index, enabled))
									}
									onArgsMatchChange={
										onArgsMatchChange &&
										((argsMatch) => onArgsMatchChange(message.index, argsMatch))
									}
									onTextChange={
										expectable && onExpectedChange
											? (text) => onExpectedChange(message.index, text)
											: undefined
									}
									onSaveAsExpected={
										expectable &&
										onSaveAsExpected &&
										message.step.kind === "final" &&
										message.produced !== undefined
											? () => onSaveAsExpected(message.index)
											: undefined
									}
									onCompare={
										expectable &&
										onCompare &&
										message.step.kind === "final" &&
										message.produced !== undefined
											? () => onCompare(message.index)
											: undefined
									}
								/>
							);
						})}
					</TurnSection>
				);
			})}

			{live?.isRunning && !live.pendingTool && (
				<Card>
					<CardContent className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Waiting for the model...
					</CardContent>
				</Card>
			)}

			{live?.pendingTool && (
				<Card>
					<CardContent className="flex flex-col gap-2 p-3">
						<div className="text-sm">
							Result for <span className="font-medium">{live.pendingTool}</span>
						</div>
						<Textarea
							value={result}
							onChange={(event) => setResult(event.target.value)}
							placeholder='{"temp": 12}'
						/>
						<Button
							className="self-end"
							onClick={() => {
								// `pendingTool` is read inside the handler, so the non-null
								// assertion the compiler wants is avoided by capturing it.
								const tool = live.pendingTool;
								if (!tool) return;
								live.onToolResult(tool, result);
								setResult("");
							}}
						>
							Continue
						</Button>
					</CardContent>
				</Card>
			)}

			{live?.error && !live.isRunning && (
				<Card className="border-destructive">
					<CardContent className="flex flex-col gap-2 p-3">
						<div className="text-sm text-destructive">Turn failed: {live.error}</div>
						<Button className="self-end" variant="outline" onClick={live.onRetry}>
							Retry
						</Button>
					</CardContent>
				</Card>
			)}

			{onOrderMattersChange && !readOnly && (
				<div className="flex items-center gap-2">
					<Checkbox
						checked={orderMatters === true}
						disabled={saving}
						onCheckedChange={(checked) => onOrderMattersChange(checked === true)}
					/>
					{/*
					 * Per turn, not per session: the comparison matches each turn's steps
					 * against that turn's, so the order this asserts is the order WITHIN a
					 * turn. Turns themselves are always in order.
					 */}
					<span className="text-sm">Steps must happen in this order within a turn</span>
				</div>
			)}

			{/*
			 * A button, not a standing textarea. An always-open field at the end of every
			 * finished run is a permanent invitation the author usually declines, and it
			 * pushed everything below it down the page for nothing.
			 */}
			{canReply && !replying && (
				<Button variant="outline" className="w-full" onClick={() => setReplying(true)}>
					+ Add message
				</Button>
			)}

			{canReply && replying && (
				<Card>
					<CardContent className="flex flex-col gap-2 p-3">
						<Textarea
							autoFocus
							value={reply}
							onChange={(event) => setReply(event.target.value)}
							placeholder="Ask a follow-up..."
						/>
						<div className="flex justify-end gap-2">
							<Button
								variant="ghost"
								onClick={() => {
									setReplying(false);
									setReply("");
								}}
							>
								Cancel
							</Button>
							<Button
								disabled={!reply.trim()}
								onClick={() => {
									// Untrimmed, this pins surrounding whitespace into durable
									// step text -- the button is disabled on the same
									// `.trim()`, so a click here always has something worth
									// sending.
									live?.onReply(reply.trim());
									setReply("");
									setReplying(false);
								}}
							>
								Continue
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
