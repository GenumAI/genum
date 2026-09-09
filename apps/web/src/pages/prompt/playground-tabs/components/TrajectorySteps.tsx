import { useState } from "react";
import { Wrench, ChatText } from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import type { Step } from "@/types/steps";

interface TrajectoryStepsProps {
	steps: Step[];
	/** Tool the run is paused on, waiting for the author to supply a result. */
	pendingTool: string | null;
	onToolResult: (name: string, result: string) => void;
	/**
	 * The author typed a follow-up after the model's final answer. Continues the same
	 * session -- what makes a finished run distinguishable from an agentic one that has
	 * simply run out of input for now.
	 */
	onReply: (text: string) => void;
	/**
	 * The last continuation's round trip failed, with this message; null otherwise. A
	 * failed turn ends on a step that is neither a pending tool nor a `final` -- without
	 * showing this and a way to retry, the pane would be a dead end with no control at
	 * all, recoverable only by discarding the whole recording with a fresh "Run".
	 */
	error: string | null;
	/** Retries the failed continuation without re-adding the tool result or reply. */
	onRetry: () => void;
	/**
	 * A turn is in flight. Between submitting a tool result and the model's reply there
	 * is no pending tool and no new step, so without this the pane is a static list with
	 * no sign that anything is happening.
	 */
	isRunning?: boolean;
}

/**
 * Renders a recorded agentic run as a step list. The tool is never executed here, and
 * never will be: the author supplies the result, which is what makes the run recordable
 * and, later, replayable.
 */
export function TrajectorySteps({
	steps,
	pendingTool,
	onToolResult,
	onReply,
	error,
	onRetry,
	isRunning = false,
}: TrajectoryStepsProps) {
	const [result, setResult] = useState("");
	const [reply, setReply] = useState("");

	// A follow-up only makes sense once the model has finished answering: no tool call is
	// still waiting on a result, no turn is in flight, and the session has not simply run
	// out of steps (an empty trajectory renders nothing here at all -- see Playground.tsx).
	const lastStep = steps[steps.length - 1];
	const canReply = !isRunning && !pendingTool && lastStep?.kind === "final";

	return (
		<div className="flex flex-col gap-2">
			{steps.map((step, index) => (
				<Card key={`${step.kind}-${index}`}>
					<CardContent className="flex gap-3 p-3">
						{step.kind === "tool_call" ? (
							<Wrench className="mt-1 shrink-0" size={16} />
						) : (
							<ChatText className="mt-1 shrink-0" size={16} />
						)}
						<div className="min-w-0 flex-1">
							{step.kind === "tool_call" ? (
								<>
									<div className="font-medium">{step.name}</div>
									<pre className="mt-1 overflow-x-auto text-xs">
										{JSON.stringify(step.args ?? {}, null, 2)}
									</pre>
									{step.recordedResult !== undefined && (
										<div className="mt-2 text-xs text-muted-foreground">
											<span className="font-medium">Result: </span>
											<span className="whitespace-pre-wrap">
												{step.recordedResult}
											</span>
										</div>
									)}
								</>
							) : step.kind === "user" ? (
								// Labeled, unlike `final`: in a five-step list of `final`/`user`
								// rows sharing one icon and one plain-text rendering, the author
								// could not otherwise tell their own words from the model's --
								// the exact readability complaint this feature exists to fix.
								<>
									<div className="text-xs font-medium text-muted-foreground">
										You
									</div>
									<div className="whitespace-pre-wrap">{step.text}</div>
								</>
							) : (
								<div className="whitespace-pre-wrap">{step.text}</div>
							)}
						</div>
					</CardContent>
				</Card>
			))}

			{isRunning && !pendingTool && (
				<Card>
					<CardContent className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Waiting for the model...
					</CardContent>
				</Card>
			)}

			{pendingTool && (
				<Card>
					<CardContent className="flex flex-col gap-2 p-3">
						<div className="text-sm">
							Result for <span className="font-medium">{pendingTool}</span>
						</div>
						<Textarea
							value={result}
							onChange={(event) => setResult(event.target.value)}
							placeholder='{"temp": 12}'
						/>
						<Button
							className="self-end"
							onClick={() => {
								onToolResult(pendingTool, result);
								setResult("");
							}}
						>
							Continue
						</Button>
					</CardContent>
				</Card>
			)}

			{canReply && (
				<Card>
					<CardContent className="flex flex-col gap-2 p-3">
						<div className="text-sm">Continue the session</div>
						<Textarea
							value={reply}
							onChange={(event) => setReply(event.target.value)}
							placeholder="Ask a follow-up..."
						/>
						<Button
							className="self-end"
							disabled={!reply.trim()}
							onClick={() => {
								// Untrimmed, this pins surrounding whitespace into durable step
								// text -- the button is disabled on the same `.trim()`, so a
								// click here always has something worth sending.
								onReply(reply.trim());
								setReply("");
							}}
						>
							Continue
						</Button>
					</CardContent>
				</Card>
			)}

			{error && !isRunning && (
				<Card className="border-destructive">
					<CardContent className="flex flex-col gap-2 p-3">
						<div className="text-sm text-destructive">Turn failed: {error}</div>
						<Button className="self-end" variant="outline" onClick={onRetry}>
							Retry
						</Button>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
