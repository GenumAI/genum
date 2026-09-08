import type { ConversationMessage, ToolCall } from "@/ai/providers";
import { effectiveSteps, turnsOf } from "./session";
import type { Step, ToolCallStep } from "./types";

export type ModelTurn = {
	answer: string;
	toolCalls?: ToolCall[];
};

export type ReplayStop = {
	reason: "missing_recording" | "step_limit";
	tool?: string;
	/** 1-based, for the author reading the message. */
	turn?: number;
	message: string;
};

export type ReplayResult = {
	steps: Step[];
	stopped?: ReplayStop;
};

export type ReplayParams = {
	callModel: (messages: ConversationMessage[]) => Promise<ModelTurn>;
	/** The pinned session. Tool results are replayed from it; a tool is never executed. */
	recorded: Step[];
	maxSteps?: number;
};

/**
 * Floor for a replay that has nothing longer to go on. It is not `recursionLimit` from
 * `ai/runner/agent.ts` (that is 4) and is not meant to track it: a replay is bounded by
 * the recording it replays, not by how deep the live agent is allowed to recurse.
 */
export const DEFAULT_MAX_STEPS = 8;

/**
 * The bound a replay of this recording needs. Each turn of the loop below is one model
 * call, and a session needs one call per recorded tool call plus one per turn for that
 * turn's answer. The old `+ 1` was the single final answer of a one-turn recording; a
 * five-turn session budgeted that way stops at `step_limit` and is written NOK on every
 * run, forever -- the exact failure this function exists to remove.
 *
 * Derived from the EFFECTIVE list: a truncated session is budgeted by what it runs.
 */
export function maxStepsForRecording(recorded: Step[]): number {
	const effective = effectiveSteps(recorded);
	const toolCalls = effective.filter((step) => step.kind === "tool_call").length;
	const turns = turnsOf(effective).length;
	return Math.max(DEFAULT_MAX_STEPS, toolCalls + turns);
}

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
	const turns = turnsOf(effectiveSteps(recorded));
	const messages: ConversationMessage[] = [];
	const steps: Step[] = [];
	let turnIndex = 0;
	// Per turn, not per session: a tool called in turns 1 and 3 must take turn 3's
	// recording for turn 3, the same way the comparison matches within a turn.
	let seen = new Map<string, number>();

	for (let step = 0; step < maxSteps; step++) {
		const turn = await callModel(messages);

		if (!turn.toolCalls || turn.toolCalls.length === 0) {
			steps.push({ kind: "final", text: turn.answer });

			const next = turns[turnIndex + 1];
			const reply = next?.steps[0];
			if (!next || reply?.kind !== "user") {
				return { steps };
			}

			// The reply is emitted as a step as well as fed to the model: `lastSteps` has
			// to carry the same turn structure as `expectedSteps`, or the panel can group
			// the expectation and not the actual run.
			steps.push({ kind: "user", text: reply.text });
			messages.push({ role: "user", content: reply.text });
			turnIndex += 1;
			seen = new Map();
			continue;
		}

		messages.push({ role: "assistant", content: turn.answer, toolCalls: turn.toolCalls });

		const turnRecording = turns[turnIndex]?.steps ?? [];

		for (const call of turn.toolCalls) {
			const ordinal = seen.get(call.name) ?? 0;
			seen.set(call.name, ordinal + 1);

			const match = turnRecording.filter(
				(entry): entry is ToolCallStep =>
					entry.kind === "tool_call" && entry.name === call.name,
			)[ordinal];

			if (!match || match.recordedResult === undefined) {
				return {
					steps,
					stopped: {
						reason: "missing_recording",
						tool: call.name,
						turn: turnIndex + 1,
						message: `tool "${call.name}" was called in turn ${turnIndex + 1} but the recording has no result for it`,
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
			turn: turnIndex + 1,
			message: `replay stopped after ${maxSteps} steps, in turn ${turnIndex + 1}`,
		},
	};
}
