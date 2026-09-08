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
});
