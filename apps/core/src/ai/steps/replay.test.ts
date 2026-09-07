import { describe, it, expect, vi } from "vitest";
import { DEFAULT_MAX_STEPS, maxStepsForRecording, replayTrajectory } from "./replay";
import type { ToolCallStep } from "./types";

const recorded: ToolCallStep[] = [
	{
		kind: "tool_call",
		name: "get_weather",
		args: { city: "Berlin" },
		recordedResult: '{"temp":12}',
	},
];

describe("replayTrajectory", () => {
	it("feeds the recorded result back and returns the trajectory", async () => {
		const callModel = vi
			.fn()
			.mockResolvedValueOnce({
				answer: "",
				toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Berlin" } }],
			})
			.mockResolvedValueOnce({ answer: "It is 12°" });

		const result = await replayTrajectory({ callModel, recorded });

		expect(result.stopped).toBeUndefined();
		// The step carries the result the loop fed back, so the trajectory is readable
		// without the recording it was replayed from (spans, and the UI's diff of
		// `lastSteps`, both depend on this).
		expect(result.steps).toEqual([
			{
				kind: "tool_call",
				name: "get_weather",
				args: { city: "Berlin" },
				recordedResult: '{"temp":12}',
			},
			{ kind: "final", text: "It is 12°" },
		]);

		// The second call must carry the tool result back to the model.
		expect(callModel).toHaveBeenCalledTimes(2);
		expect(callModel.mock.calls[1][0]).toEqual([
			{
				role: "assistant",
				content: "",
				toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Berlin" } }],
			},
			{ role: "tool", toolCallId: "c1", name: "get_weather", content: '{"temp":12}' },
		]);
	});

	it("stops and names the tool when the recording has no result for it", async () => {
		const callModel = vi.fn().mockResolvedValue({
			answer: "",
			toolCalls: [{ id: "c9", name: "send_mail", args: { to: "a@b.c" } }],
		});

		const result = await replayTrajectory({ callModel, recorded });

		expect(result.stopped?.reason).toBe("missing_recording");
		expect(result.stopped?.tool).toBe("send_mail");
		expect(result.stopped?.message).toContain("send_mail");
		expect(callModel).toHaveBeenCalledTimes(1);
	});

	it("returns a final step immediately when no tool is called", async () => {
		const callModel = vi.fn().mockResolvedValue({ answer: "It is 12°" });

		const result = await replayTrajectory({ callModel, recorded });

		expect(result.steps).toEqual([{ kind: "final", text: "It is 12°" }]);
	});

	it("stops at the step limit", async () => {
		// Enough recordings for every one of the maxSteps turns, so the loop runs out of
		// steps before it could ever run out of recordings -- otherwise this would stop
		// with "missing_recording" on the second turn instead of exercising the step
		// limit, since the recording only had a single entry.
		const manyRecordings: ToolCallStep[] = [
			{ kind: "tool_call", name: "get_weather", recordedResult: "r1" },
			{ kind: "tool_call", name: "get_weather", recordedResult: "r2" },
			{ kind: "tool_call", name: "get_weather", recordedResult: "r3" },
		];
		const callModel = vi.fn().mockResolvedValue({
			answer: "",
			toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Berlin" } }],
		});

		const result = await replayTrajectory({
			callModel,
			recorded: manyRecordings,
			maxSteps: 3,
		});

		expect(result.stopped?.reason).toBe("step_limit");
		expect(callModel).toHaveBeenCalledTimes(3);
	});

	// A nine-tool-call trajectory is legitimately recordable (the playground caps a
	// conversation at 100 messages, and nothing bounds what the picker can pin). Under the
	// fixed default of 8 it stopped at `step_limit` and was written NOK on every run,
	// forever -- a testcase that can never pass. The bound has to come from the recording.
	it("replays a recording longer than the default step limit", async () => {
		const nine: ToolCallStep[] = Array.from({ length: 9 }, (_, i) => ({
			kind: "tool_call" as const,
			name: "search",
			recordedResult: `r${i}`,
		}));
		const callModel = vi.fn();
		for (let i = 0; i < 9; i++) {
			callModel.mockResolvedValueOnce({
				answer: "",
				toolCalls: [{ id: `c${i}`, name: "search", args: { page: i } }],
			});
		}
		callModel.mockResolvedValueOnce({ answer: "done" });

		const result = await replayTrajectory({
			callModel,
			recorded: nine,
			maxSteps: maxStepsForRecording(nine.length),
		});

		expect(result.stopped).toBeUndefined();
		// Nine tool turns plus the final answer: one model call per turn, so the bound
		// must be recorded.length + 1, not recorded.length.
		expect(callModel).toHaveBeenCalledTimes(10);
	});

	it("derives a bound that still fires for a runaway loop", () => {
		// Never below the default, and exactly one turn of headroom over a recording that
		// calls one tool per turn -- so a model that keeps calling tools past the end of
		// the recording still hits `step_limit`.
		expect(maxStepsForRecording(0)).toBe(DEFAULT_MAX_STEPS);
		expect(maxStepsForRecording(3)).toBe(DEFAULT_MAX_STEPS);
		expect(maxStepsForRecording(9)).toBe(10);
	});

	it("still bounds a model that never stops calling tools", async () => {
		// A model that keeps asking past the end of the recording is stopped -- by
		// `missing_recording` on the turn after the last recorded call, which under a
		// recording-derived bound always arrives before `step_limit` does (each turn
		// consumes at least one recording, and the bound is recorded.length + 1). Both
		// stops are NOK with a message; this one names the tool, which is the truer cause.
		// `step_limit` stays as the backstop for a caller that passes its own maxSteps --
		// the test above.
		const many: ToolCallStep[] = Array.from({ length: 20 }, (_, i) => ({
			kind: "tool_call" as const,
			name: "search",
			recordedResult: `r${i}`,
		}));
		const callModel = vi.fn().mockResolvedValue({
			answer: "",
			toolCalls: [{ id: "c", name: "search", args: {} }],
		});

		const result = await replayTrajectory({
			callModel,
			recorded: many,
			maxSteps: maxStepsForRecording(many.length),
		});

		expect(result.stopped).toBeDefined();
		expect(result.stopped?.reason).toBe("missing_recording");
		// Never more turns than the derived bound allows.
		expect(callModel.mock.calls.length).toBeLessThanOrEqual(maxStepsForRecording(many.length));
	});

	it("matches repeated calls to the same tool by their ordinal", async () => {
		const twice: ToolCallStep[] = [
			{ kind: "tool_call", name: "get_weather", recordedResult: "first" },
			{ kind: "tool_call", name: "get_weather", recordedResult: "second" },
		];
		const callModel = vi
			.fn()
			.mockResolvedValueOnce({
				answer: "",
				toolCalls: [{ id: "c1", name: "get_weather", args: {} }],
			})
			.mockResolvedValueOnce({
				answer: "",
				toolCalls: [{ id: "c2", name: "get_weather", args: {} }],
			})
			.mockResolvedValueOnce({ answer: "done" });

		const result = await replayTrajectory({ callModel, recorded: twice });

		expect(callModel.mock.calls[2][0].at(-1)).toEqual({
			role: "tool",
			toolCallId: "c2",
			name: "get_weather",
			content: "second",
		});
		// Each step keeps its own result, so two calls to the same tool do not collapse
		// into one -- that collapsing is the defect a name-keyed results map caused here
		// once already, and the spans written from these steps would inherit it.
		expect(
			result.steps.flatMap((step) => (step.kind === "tool_call" ? [step.recordedResult] : [])),
		).toEqual(["first", "second"]);
	});
});
