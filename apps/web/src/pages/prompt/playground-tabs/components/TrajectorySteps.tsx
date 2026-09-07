import { useState } from "react";
import { Wrench, ChatText } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import type { Step } from "@/types/steps";

interface TrajectoryStepsProps {
	steps: Step[];
	/** Tool the run is paused on, waiting for the author to supply a result. */
	pendingTool: string | null;
	onToolResult: (name: string, result: string) => void;
}

/**
 * Renders a recorded agentic run as a step list. The tool is never executed here, and
 * never will be: the author supplies the result, which is what makes the run recordable
 * and, later, replayable.
 */
export function TrajectorySteps({ steps, pendingTool, onToolResult }: TrajectoryStepsProps) {
	const [result, setResult] = useState("");

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
							) : (
								<div className="whitespace-pre-wrap">{step.text}</div>
							)}
						</div>
					</CardContent>
				</Card>
			))}

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
		</div>
	);
}
