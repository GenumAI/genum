import type { ConversationMessage, ToolCall } from "@/ai/providers";
import type { Step, ToolCallStep } from "./types";

export type ModelTurn = {
	answer: string;
	toolCalls?: ToolCall[];
};

export type ReplayStop = {
	reason: "missing_recording" | "step_limit";
	tool?: string;
	message: string;
};

export type ReplayResult = {
	steps: Step[];
	stopped?: ReplayStop;
};

export type ReplayParams = {
	callModel: (messages: ConversationMessage[]) => Promise<ModelTurn>;
	/** Tool results from the original run. A tool is never executed. */
	recorded: ToolCallStep[];
	maxSteps?: number;
};

/** Mirrors `recursionLimit` in `ai/runner/agent.ts:158`. */
const DEFAULT_MAX_STEPS = 8;

/**
 * Drives the agent loop against recorded tool results. A tool call the recording does
 * not cover stops the replay and names the tool: substituting an empty result would
 * fail somewhere further down the chain and report the wrong cause.
 */
export async function replayTrajectory({
	callModel,
	recorded,
	maxSteps = DEFAULT_MAX_STEPS,
}: ReplayParams): Promise<ReplayResult> {
	const messages: ConversationMessage[] = [];
	const steps: Step[] = [];
	// How many times each tool has been called so far, so a second call to the same
	// tool picks up the second recording rather than replaying the first.
	const seen = new Map<string, number>();

	for (let step = 0; step < maxSteps; step++) {
		const turn = await callModel(messages);

		if (!turn.toolCalls || turn.toolCalls.length === 0) {
			steps.push({ kind: "final", text: turn.answer });
			return { steps };
		}

		messages.push({
			role: "assistant",
			content: turn.answer,
			toolCalls: turn.toolCalls,
		});

		for (const call of turn.toolCalls) {
			const ordinal = seen.get(call.name) ?? 0;
			seen.set(call.name, ordinal + 1);

			const match = recorded.filter((entry) => entry.name === call.name)[ordinal];

			if (!match || match.recordedResult === undefined) {
				return {
					steps,
					stopped: {
						reason: "missing_recording",
						tool: call.name,
						message: `tool "${call.name}" was called but the recording has no result for it`,
					},
				};
			}

			// The result is carried on the step, not just fed to the model: a trajectory
			// has to be readable on its own. `lastSteps` and the run's `trace_spans` rows
			// both need to say what the tool returned during THIS run, and this loop is
			// the only place that knows it as it happens. It is also in `expectedSteps`,
			// and that redundancy is the point -- neither the span row nor the last-run
			// trajectory should need the expectation to still exist to be interpretable.
			steps.push({
				kind: "tool_call",
				name: call.name,
				args: call.args,
				recordedResult: match.recordedResult,
			});
			messages.push({
				role: "tool",
				toolCallId: call.id,
				name: call.name,
				content: match.recordedResult,
			});
		}
	}

	return {
		steps,
		stopped: {
			reason: "step_limit",
			message: `replay stopped after ${maxSteps} steps`,
		},
	};
}
