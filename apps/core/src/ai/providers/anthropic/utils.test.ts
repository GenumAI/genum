import { describe, it, expect } from "vitest";
import { mapMessagesAnthropic } from "./utils";
import type { ProviderRequest } from "..";

function request(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
	return {
		apikey: "key",
		instruction: "You are helpful",
		question: "Hello",
		model: "claude-sonnet-5",
		parameters: {},
		promptPrice: 0.44,
		completionPrice: 1.32,
		...overrides,
	};
}

describe("mapMessagesAnthropic with no conversation", () => {
	it("is unchanged when no messages and no files are passed", () => {
		expect(mapMessagesAnthropic(request())).toEqual([
			{
				role: "user",
				content: "Hello",
			},
		]);
	});

	it("is unchanged when files are present but no messages are passed", () => {
		const files = [
			{
				id: "1",
				buffer: Buffer.from(""),
				contentType: "image/png",
				fileName: "a.png",
			},
		];

		expect(mapMessagesAnthropic(request({ files }))).toEqual([
			{
				role: "user",
				content: [
					{ type: "text", text: "Hello" },
					{
						type: "image",
						source: { type: "base64", media_type: "image/png", data: "" },
					},
				],
			},
		]);
	});
});

describe("mapMessagesAnthropic with a conversation", () => {
	it("maps a user reply to a plain user turn, not a tool_result block", () => {
		const turns = mapMessagesAnthropic(
			request({
				messages: [
					{ role: "assistant", content: "one", toolCalls: [] },
					{ role: "user", content: "and in London?" },
				],
			}),
		);

		expect(turns).toContainEqual({ role: "user", content: "and in London?" });
	});

	it("drops an empty assistant turn rather than emitting an empty block for it", () => {
		// Anthropic rejects `content: []` AND rejects a text block whose text is empty, so
		// neither an empty array nor `[{type:"text", text:""}]` is a valid mapping -- the
		// turn has to go. Reachable since the client and `replayTrajectory` both append an
		// assistant message for every turn's answer, and a turn can answer with "".
		const turns = mapMessagesAnthropic(
			request({ messages: [{ role: "assistant", content: "" }] }),
		) as { role: string; content: unknown }[];

		expect(turns.some((turn) => turn.role === "assistant")).toBe(false);
	});

	it("keeps an assistant turn that has only tool calls", () => {
		// The other half: dropping empties must not drop a turn whose text is empty
		// because it called a tool instead of answering.
		const turns = mapMessagesAnthropic(
			request({
				messages: [
					{
						role: "assistant",
						content: "",
						toolCalls: [{ id: "1", name: "weather", args: { city: "Paris" } }],
					},
				],
			}),
		) as { role: string; content: { type: string }[] }[];

		const assistant = turns.find((turn) => turn.role === "assistant");
		expect(assistant?.content).toEqual([
			{ type: "tool_use", id: "1", name: "weather", input: { city: "Paris" } },
		]);
	});
});
