import { describe, it, expect } from "vitest";
import { mapMessagesDeepSeek, mapToolsDeepSeek, responseFormatDeepSeek } from "./utils";
import type { ProviderRequest } from "..";

function request(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
	return {
		apikey: "key",
		instruction: "You are helpful",
		question: "Hello",
		model: "deepseek-v4-flash",
		parameters: {},
		promptPrice: 0.44,
		completionPrice: 1.32,
		...overrides,
	};
}

describe("DeepSeek request mappers", () => {
	describe("mapMessagesDeepSeek", () => {
		it("maps instruction and question to system and user messages", () => {
			expect(mapMessagesDeepSeek(request())).toEqual([
				{ role: "system", content: "You are helpful" },
				{ role: "user", content: "Hello" },
			]);
		});

		it("accepts an empty file list", () => {
			expect(mapMessagesDeepSeek(request({ files: [] }))).toHaveLength(2);
		});

		it("refuses attachments rather than dropping them silently", () => {
			const files = [
				{
					id: "1",
					buffer: Buffer.from(""),
					contentType: "image/png",
					fileName: "a.png",
				},
			];

			expect(() => mapMessagesDeepSeek(request({ files }))).toThrow(
				"DeepSeek models do not support file attachments",
			);
		});
	});

	describe("responseFormatDeepSeek", () => {
		it("passes through json_object", () => {
			expect(
				responseFormatDeepSeek(request({ parameters: { response_format: "json_object" } })),
			).toEqual({ type: "json_object" });
		});

		it("defaults to text when no format is set", () => {
			expect(responseFormatDeepSeek(request())).toEqual({ type: "text" });
		});

		it("falls back to text for json_schema, which DeepSeek does not support", () => {
			expect(
				responseFormatDeepSeek(request({ parameters: { response_format: "json_schema" } })),
			).toEqual({ type: "text" });
		});
	});

	describe("mapToolsDeepSeek", () => {
		it("nests our flat tool shape under `function`", () => {
			const tools = [
				{
					name: "get_weather",
					description: "Look up weather",
					parameters: { type: "object", properties: {} },
				},
			];

			expect(mapToolsDeepSeek(tools)).toEqual([
				{
					type: "function",
					function: {
						name: "get_weather",
						description: "Look up weather",
						parameters: { type: "object", properties: {} },
						strict: false,
					},
				},
			]);
		});

		it("keeps an explicit strict flag", () => {
			const tools = [{ name: "t", strict: true, parameters: { type: "object" } }];

			expect(mapToolsDeepSeek(tools)[0].function.strict).toBe(true);
		});
	});
});
