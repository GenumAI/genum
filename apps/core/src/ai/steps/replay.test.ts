import { describe, it, expect, vi } from "vitest";
import { replayTrajectory } from "./replay";
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
		expect(result.steps).toEqual([
			{ kind: "tool_call", name: "get_weather", args: { city: "Berlin" } },
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

		await replayTrajectory({ callModel, recorded: twice });

		expect(callModel.mock.calls[2][0].at(-1)).toEqual({
			role: "tool",
			toolCallId: "c2",
			name: "get_weather",
			content: "second",
		});
	});
});
